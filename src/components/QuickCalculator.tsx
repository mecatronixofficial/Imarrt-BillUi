'use client';

import { useEffect, useRef, useState } from 'react';
import { Delete } from 'lucide-react';

/** Evaluates + - * / % and parentheses without eval; returns null for incomplete input. */
function evaluate(expression: string): number | null {
  const tokens = expression.replace(/\s+/g, '').match(/\d*\.?\d+|[-+*/%()]/g);
  if (!tokens || tokens.join('') !== expression.replace(/\s+/g, '')) return null;
  let position = 0;
  const peek = () => tokens[position];
  function factor(): number {
    const token = tokens![position++];
    if (token === '-') return -factor();
    if (token === '+') return factor();
    if (token === '(') {
      const value = sum();
      if (tokens![position++] !== ')') throw new Error('Unclosed bracket');
      return value;
    }
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error('Invalid number');
    if (peek() === '%') { position++; return value / 100; }
    return value;
  }
  function product(): number {
    let value = factor();
    while (peek() === '*' || peek() === '/') value = tokens![position++] === '*' ? value * factor() : value / factor();
    return value;
  }
  function sum(): number {
    let value = product();
    while (peek() === '+' || peek() === '-') value = tokens![position++] === '+' ? value + product() : value - product();
    return value;
  }
  try {
    const result = sum();
    return position === tokens.length && Number.isFinite(result) ? Math.round(result * 1e8) / 1e8 : null;
  } catch {
    return null;
  }
}

const KEYS = ['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '%', '+'];

export default function QuickCalculator({ onClose }: { onClose: () => void }) {
  const [expression, setExpression] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const result = evaluate(expression);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div
      className="quick-calculator"
      role="dialog"
      aria-label="Calculator"
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}
    >
      <input
        ref={inputRef}
        aria-label="Calculation"
        value={expression}
        placeholder="0"
        onChange={(event) => setExpression(event.target.value.replace(/[^0-9+\-*/%.() ]/g, ''))}
        onKeyDown={(event) => { if (event.key === 'Enter' && result !== null) setExpression(String(result)); }}
      />
      <output aria-live="polite">{result !== null && expression ? `= ${result.toLocaleString('en-IN')}` : ' '}</output>
      <div>
        {KEYS.map((key) => <button key={key} type="button" onClick={() => setExpression((value) => value + key)}>{key === '*' ? '×' : key === '/' ? '÷' : key}</button>)}
        <button type="button" onClick={() => setExpression('')}>C</button>
        <button type="button" aria-label="Delete last character" onClick={() => setExpression((value) => value.slice(0, -1))}><Delete size={16} /></button>
        <button type="button" className="quick-calculator-equals" disabled={result === null} onClick={() => result !== null && setExpression(String(result))}>=</button>
      </div>
    </div>
  );
}
