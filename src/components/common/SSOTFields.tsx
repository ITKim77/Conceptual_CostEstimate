// src/components/common/SSOTFields.tsx
import React from 'react';

interface SSOTInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  unit?: string;
  helperText?: string;
}

/**
 * [Red] 단일 위치 정의 사용자 입력 필드
 * 빨간색 테두리와 포커스 링, Red 라벨 배지를 통해 원천 입력값임을 명시
 */
export const SSOTInput: React.FC<SSOTInputProps> = ({
  label,
  unit,
  helperText,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-red-600 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
          {label}
        </label>
        {unit && <span className="text-[11px] font-medium text-slate-500">{unit}</span>}
      </div>
      <div className="relative rounded-md shadow-sm">
        <input
          {...props}
          className={`block w-full rounded-md border-2 border-red-300 px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 bg-red-50/20 transition-colors ${className}`}
        />
      </div>
      {helperText && <p className="text-[10px] text-slate-500">{helperText}</p>}
    </div>
  );
};

interface SSOTSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  helperText?: string;
  children: React.ReactNode;
}

export const SSOTSelect: React.FC<SSOTSelectProps> = ({
  label,
  helperText,
  children,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-red-600 flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
        {label}
      </label>
      <select
        {...props}
        className={`block w-full rounded-md border-2 border-red-300 px-3 py-1.5 text-sm font-semibold text-slate-900 shadow-sm focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 bg-red-50/20 transition-colors ${className}`}
      >
        {children}
      </select>
      {helperText && <p className="text-[10px] text-slate-500">{helperText}</p>}
    </div>
  );
};

interface SSOTDerivedProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * [Blue] 연산 및 인용 파생값 디스플레이
 * 파란색 텍스트 및 배경, 읽기 전용으로 수정 불가
 */
export const SSOTDerivedValue: React.FC<SSOTDerivedProps> = ({
  label,
  value,
  unit,
  subtext,
  size = 'md'
}) => {
  const formatted = typeof value === 'number' ? value.toLocaleString() : value;
  
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 transition-all hover:bg-blue-50">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-blue-800 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block"></span>
          {label}
        </span>
        <span className="text-[9px] uppercase tracking-wider text-blue-500 font-bold">Auto-Calc</span>
      </div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={`font-extrabold text-blue-700 tracking-tight ${size === 'lg' ? 'text-xl' : size === 'md' ? 'text-base' : 'text-sm'}`}>
          {formatted}
        </span>
        {unit && <span className="text-xs font-semibold text-blue-600">{unit}</span>}
      </div>
      {subtext && <span className="text-[10px] text-blue-500/80 truncate">{subtext}</span>}
    </div>
  );
};

interface SSOTConstantProps {
  label: string;
  value: string | number;
  unit?: string;
  description?: string;
}

/**
 * [Black] 시스템 상수 및 기본 가정값
 */
export const SSOTConstant: React.FC<SSOTConstantProps> = ({
  label,
  value,
  unit,
  description
}) => {
  const formatted = typeof value === 'number' ? value.toLocaleString() : value;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-b-0 text-xs">
      <div className="flex flex-col">
        <span className="font-semibold text-slate-900">{label}</span>
        {description && <span className="text-[10px] text-slate-600">{description}</span>}
      </div>
      <div className="flex items-baseline gap-1 font-mono font-bold text-slate-800">
        <span>{formatted}</span>
        {unit && <span className="text-[10px] text-slate-600">{unit}</span>}
      </div>
    </div>
  );
};

