import { describe, expect, it } from 'vitest';
import {
  gravatarUrlFor,
  md5,
  memberAvatarSource,
  normalizeGravatarEmail,
} from './avatar';

describe('md5', () => {
  it('matches RFC 1321 test vectors', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0');
    expect(md5('abcdefghijklmnopqrstuvwxyz')).toBe(
      'c3fcd3d76192e4007dfb496cca67e13b',
    );
  });

  it('handles multi-byte UTF-8 input deterministically', () => {
    expect(md5('café')).toBe(md5('café'));
    expect(md5('café')).toHaveLength(32);
    expect(md5('café')).not.toBe(md5('cafe'));
  });
});

describe('gravatar', () => {
  it('normalizes email (trim + lowercase) before hashing', () => {
    expect(normalizeGravatarEmail('  ALICE@Example.COM ')).toBe('alice@example.com');
    // md5 of the normalized form (cross-checked with python hashlib).
    expect(md5('alice@example.com')).toBe('c160f8cc69a4f0bf2b0362752353d060');
  });

  it('builds a gravatar URL with d=404 so missing faces can fall back', () => {
    const url = gravatarUrlFor('alice@example.com') as string;
    expect(url).toBe(
      'https://www.gravatar.com/avatar/c160f8cc69a4f0bf2b0362752353d060?s=200&d=404',
    );
  });

  it("is case/whitespace insensitive: 'ALICE@Example.COM' == 'alice@example.com'", () => {
    expect(gravatarUrlFor('ALICE@Example.COM')).toBe(gravatarUrlFor('alice@example.com'));
  });

  it('returns null without an email', () => {
    expect(gravatarUrlFor(undefined)).toBeNull();
    expect(gravatarUrlFor('')).toBeNull();
    expect(gravatarUrlFor('   ')).toBeNull();
  });
});

describe('memberAvatarSource', () => {
  it('photoUrl wins over gravatar', () => {
    const src = memberAvatarSource({ photoUrl: 'https://x/p.jpg', email: 'a@b.c' });
    expect(src).toBe('https://x/p.jpg');
  });

  it('falls back to gravatar when only an email exists', () => {
    const src = memberAvatarSource({ photoUrl: '', email: 'a@b.c' });
    expect(src).toBe(gravatarUrlFor('a@b.c'));
  });

  it('is null when there is neither photo nor email (initials)', () => {
    expect(memberAvatarSource({})).toBeNull();
    expect(memberAvatarSource({ photoUrl: null, email: null })).toBeNull();
  });
});
