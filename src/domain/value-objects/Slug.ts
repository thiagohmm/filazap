import { InvalidSlugError } from '../errors/InvalidSlugError';

export class Slug {
  private constructor(readonly value: string) {}

  static create(raw: string): Slug {
    const slug = raw.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new InvalidSlugError(raw);
    }
    return new Slug(slug);
  }

  static createFromName(name: string): Slug {
    const slug = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return Slug.create(slug);
  }
}
