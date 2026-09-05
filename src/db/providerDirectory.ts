/**
 * Data-access seam for the provider directory.
 *
 * Tools depend only on this interface. To go live with real data, implement
 * this against your source (hospital APIs, a database, a FHIR server, ...)
 * and swap the export below. No tool code needs to change.
 */

import { MOCK_PROVIDERS, type Provider } from "../data/providers.js";

export interface ProviderQuery {
  /** City name, matched loosely (e.g. "bengaluru", "bangalore"). */
  location?: string;
  /** Specialty, matched case-insensitively. */
  specialty?: string;
  /** Only providers offering telehealth. */
  telehealthOnly?: boolean;
  /** Only emergency departments. */
  emergencyOnly?: boolean;
  limit?: number;
}

export interface ProviderDirectory {
  search(query: ProviderQuery): Promise<Provider[]>;
  getById(id: string): Promise<Provider | undefined>;
}

const CITY_ALIASES: Record<string, string[]> = {
  bangalore: ["bengaluru"],
  bengaluru: ["bengaluru"],
  chennai: ["chennai"],
  madras: ["chennai"],
  mumbai: ["mumbai"],
  bombay: ["mumbai"],
  delhi: ["delhi"],
  "new delhi": ["delhi"],
  hyderabad: ["hyderabad"],
  pune: ["pune"],
};

function normalizeCity(city: string): string {
  const key = city.trim().toLowerCase();
  return CITY_ALIASES[key]?.[0] ?? key;
}

export class MockProviderDirectory implements ProviderDirectory {
  private readonly providers: Provider[];

  constructor(providers: Provider[] = MOCK_PROVIDERS) {
    this.providers = providers;
  }

  async search(query: ProviderQuery): Promise<Provider[]> {
    let results = this.providers;

    if (query.emergencyOnly) {
      results = results.filter((p) => p.emergency === true);
    }
    if (query.location) {
      const wanted = normalizeCity(query.location);
      results = results.filter((p) => normalizeCity(p.city) === wanted);
    }
    if (query.specialty) {
      const wanted = query.specialty.trim().toLowerCase();
      results = results.filter((p) => p.specialty.toLowerCase().includes(wanted));
    }
    if (query.telehealthOnly) {
      results = results.filter((p) => p.telehealthAvailable);
    }

    results = [...results].sort(
      (a, b) => b.rating - a.rating || a.name.localeCompare(b.name),
    );

    if (query.limit && query.limit > 0) {
      results = results.slice(0, query.limit);
    }
    return results;
  }

  async getById(id: string): Promise<Provider | undefined> {
    return this.providers.find((p) => p.id === id);
  }
}

/** Singleton used by the MCP tools. Swap this export to change data source. */
export const providerDirectory: ProviderDirectory = new MockProviderDirectory();