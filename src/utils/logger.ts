// src/utils/logger.ts
import { config } from '../config/index.js';

/**
 * Log levels in order of severity
 */
type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Simple logger utility
 */
export class Logger {
  private readonly levelPriority: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };
  
  constructor(private readonly context: string) {}
  
  /**
   * Check if the current level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const configLevel = config.logging.level as LogLevel;
    return this.levelPriority[level] <= this.levelPriority[configLevel];
  }
  
  /**
   * Format the log message
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`;
  }
  
  /**
   * Log an error message
   */
  error(message: string, error?: unknown): void {
    if (!this.shouldLog('error')) return;
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    const logMessage = error ? `${message}: ${errorMessage}` : message;
    
    console.error(this.formatMessage('error', logMessage));
    
    // Log stack trace if available
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }
  
  /**
   * Log a warning message
   */
  warn(message: string): void {
    if (!this.shouldLog('warn')) return;
    console.warn(this.formatMessage('warn', message));
  }
  
  /**
   * Log an info message
   */
  info(message: string): void {
    if (!this.shouldLog('info')) return;
    console.info(this.formatMessage('info', message));
  }
  
  /**
   * Log a debug message
   */
  debug(message: string): void {
    if (!this.shouldLog('debug')) return;
    console.debug(this.formatMessage('debug', message));
  }
}