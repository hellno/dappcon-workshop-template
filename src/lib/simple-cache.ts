// Enhanced cache with localStorage persistence
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class EnhancedCache {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private readonly storagePrefix = 'fc_cache_';

  private isClient(): boolean {
    return typeof window !== 'undefined' && !!window.localStorage;
  }

  private getStorageKey(key: string): string {
    return `${this.storagePrefix}${key}`;
  }

  private saveToStorage<T>(key: string, entry: CacheEntry<T>): void {
    if (!this.isClient()) return;
    
    try {
      localStorage.setItem(this.getStorageKey(key), JSON.stringify(entry));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  private loadFromStorage<T>(key: string): CacheEntry<T> | null {
    if (!this.isClient()) return null;
    
    try {
      const stored = localStorage.getItem(this.getStorageKey(key));
      if (!stored) return null;
      
      return JSON.parse(stored) as CacheEntry<T>;
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      return null;
    }
  }

  private removeFromStorage(key: string): void {
    if (!this.isClient()) return;
    
    try {
      localStorage.removeItem(this.getStorageKey(key));
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
    }
  }

  set<T>(key: string, data: T, ttlMs: number = 86400000, persist: boolean = true): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    };

    // Always store in memory
    this.memoryCache.set(key, entry);

    // Optionally persist to localStorage
    if (persist) {
      this.saveToStorage(key, entry);
    }
  }

  get<T>(key: string): T | null {
    // Check memory cache first
    let entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    
    // If not in memory, try localStorage
    if (!entry) {
      const storageEntry = this.loadFromStorage<T>(key);
      if (storageEntry) {
        entry = storageEntry;
        // Load back into memory cache
        this.memoryCache.set(key, entry);
      }
    }

    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.memoryCache.delete(key);
      this.removeFromStorage(key);
      return null;
    }
    
    return entry.data;
  }

  async getOrSet<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttlMs: number = 86400000,
    persist: boolean = true
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;
    
    const data = await fetcher();
    this.set(key, data, ttlMs, persist);
    return data;
  }

  // Clear all cache entries
  clear(): void {
    this.memoryCache.clear();
    
    if (!this.isClient()) return;
    
    try {
      // Remove all entries with our prefix
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.storagePrefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear localStorage cache:', error);
    }
  }

  // Get cache stats
  getStats(): { memoryCount: number; storageCount: number } {
    const memoryCount = this.memoryCache.size;
    let storageCount = 0;
    
    if (this.isClient()) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(this.storagePrefix)) {
            storageCount++;
          }
        }
      } catch (error) {
        console.warn('Failed to count localStorage entries:', error);
      }
    }
    
    return { memoryCount, storageCount };
  }
}

export const devCache = new EnhancedCache();