/**
 * Common type definitions and utilities
 */

// API Schema attribute format with proper optional types
export interface ApiSchemaAttribute {
  description: string;
  required: boolean;
  type?: string;
  nested?: boolean;
}

export interface ApiSchema {
  attributes: Record<string, ApiSchemaAttribute>;
}

// Utility functions for type safety
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

export function assertDefined<T>(value: T | undefined | null, message?: string): asserts value is T {
  if (!isDefined(value)) {
    throw new Error(message || 'Value is undefined or null');
  }
}

export function safeGet<T>(obj: Record<string, T>, key: string): T | undefined {
  return obj[key];
}

export function safeArrayAccess<T>(arr: T[], index: number): T | undefined {
  return arr[index];
}