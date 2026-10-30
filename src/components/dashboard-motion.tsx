'use client';
import {useEffect,type RefObject} from 'react';
import {mountDashboardMotion} from '@/lib/dashboard-motion';
export default function DashboardMotion({root}:{root:RefObject<HTMLDivElement|null>}){
 useEffect(()=>root.current?mountDashboardMotion(root.current):undefined,[root]);
 return null;
}
