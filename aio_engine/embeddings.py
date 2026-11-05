"""Bounded synchronous embeddings; no persistent or cross-audit cache."""
import re
import numpy as np
from google.genai import types


def embed(texts, client, model, sleep, log, batch=20, known=None, on_batch=None):
    # Reuse only exact texts from this audit; never substitute an approximate vector.
    unique = list(dict.fromkeys(texts))
    vectors = {text: np.asarray(known[text], dtype='float32') for text in unique if known and text in known}
    if any(v.ndim != 1 or not v.size or not np.isfinite(v).all() or not np.linalg.norm(v) for v in vectors.values()) or len({v.size for v in vectors.values()}) > 1:
        raise RuntimeError('Vector đã lưu không hợp lệ; dừng để tránh chấm sai.')
    missing = [text for text in unique if text not in vectors]
    for offset in range(0, len(missing), batch):
        part = missing[offset:offset + batch]
        for attempt in range(3):
            try:
                contents = [types.Content(parts=[types.Part(text=text)]) for text in part] if model.split('/')[-1] == 'gemini-embedding-2' else part
                response = client.models.embed_content(model=model, contents=contents)
                values = [np.asarray(item.values, dtype='float32') for item in (response.embeddings or [])]
                if len(values) != len(part) or any(v.ndim != 1 or not v.size or not np.isfinite(v).all() or not np.linalg.norm(v) for v in values):
                    raise RuntimeError('Gemini trả embedding thiếu hoặc không hợp lệ; dừng để tránh chấm sai.')
                if len({v.size for v in list(vectors.values()) + values}) != 1:
                    raise RuntimeError('Gemini trả vector khác kích thước; dừng để tránh chấm sai.')
                vectors.update(zip(part, values, strict=True))
                if on_batch:
                    on_batch({text: vectors[text] for text in part})
                break
            except Exception as exc:
                code = getattr(exc, 'code', None)
                message = str(exc)
                quota = code == 429 or 'RESOURCE_EXHAUSTED' in message
                temporary = quota or code in (500, 502, 503, 504)
                if not temporary:
                    if code in (400, 401, 403, 404):
                        raise RuntimeError(f'Gemini embedding ({code}), model {model}: {message[:700]}') from exc
                    raise
                # A zero/daily allowance cannot be fixed by a retry loop.
                daily = bool(re.search(r'per.?day|daily|limit[\x27\"]?\s*:\s*0\b', message, re.I))
                if daily or attempt == 2:
                    raise RuntimeError(f'Gemini embedding ({code or 429}), model {model}: {message[:700]}') from exc
                delay = re.search(r'retry(?:Delay| in)[\s\x27\":]*(\d+(?:\.\d+)?)', message, re.I)
                wait = float(delay.group(1)) + 1 if delay else 2 ** (attempt + 1)
                if wait > 60:
                    raise RuntimeError(f'Gemini yêu cầu chờ {wait:.0f}s cho embedding: {message[:700]}') from exc
                log(f'Gemini {code or 429}: thử lại sau {wait:.0f}s ({attempt + 1}/2)')
                sleep(wait)
    return [vectors[text] for text in texts]
