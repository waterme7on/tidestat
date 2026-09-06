export interface TideStatOptions {
  siteId: string;
  endpoint: string;
  consent?: boolean;
  autoPageview?: boolean;
  /** Tracks only explicitly marked data-tidestat-event elements. */
  trackClicks?: boolean;
}
export interface TideStat {
  track(type: string, properties?: Record<string, unknown>): Promise<boolean>;
  page(): Promise<boolean>;
  signup(properties?: Record<string, unknown>): Promise<boolean>;
  checkout(properties?: Record<string, unknown>): Promise<boolean>;
  /** Browser purchase is an unverified signal, never recognized revenue. */
  purchase(properties?: Record<string, unknown>): Promise<boolean>;
  attribution(): Partial<Record<'tidestat_site_id' | 'tidestat_visitor_id' | 'tidestat_session_id', string>>;
  setConsent(granted: boolean): void;
  destroy(): void;
}
export function createTideStat(options: TideStatOptions): TideStat;
