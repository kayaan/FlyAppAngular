import { beforeEach, describe, expect, it } from 'vitest';

import { FileHashService } from './file-hash.service';

describe('FileHashService', () => {
  let service: FileHashService;

  beforeEach(() => {
    service = new FileHashService();
  });

  it('should calculate the SHA-256 hash of a file', async () => {
    const file = new File(
      ['hello'],
      'test.igc',
      {
        type: 'text/plain',
      }
    );

    const result = await service.calculateFileHash(file);

    expect(result).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e' +
      '1b161e5c1fa7425e73043362938b9824'
    );
  });

  it('should return the same hash for identical file contents', async () => {
    const firstFile = new File(
      ['same content'],
      'first.igc'
    );

    const secondFile = new File(
      ['same content'],
      'second.igc'
    );

    const firstHash =
      await service.calculateFileHash(firstFile);

    const secondHash =
      await service.calculateFileHash(secondFile);

    expect(firstHash).toBe(secondHash);
  });

  it('should return different hashes for different contents', async () => {
    const firstFile = new File(
      ['first content'],
      'first.igc'
    );

    const secondFile = new File(
      ['second content'],
      'second.igc'
    );

    const firstHash =
      await service.calculateFileHash(firstFile);

    const secondHash =
      await service.calculateFileHash(secondFile);

    expect(firstHash).not.toBe(secondHash);
  });

  it('should return a lowercase hexadecimal hash', async () => {
    const file = new File(
      ['FlightApp'],
      'flight.igc'
    );

    const result = await service.calculateFileHash(file);

    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should calculate the known hash for an empty file', async () => {
    const file = new File([], 'empty.igc');

    const result = await service.calculateFileHash(file);

    expect(result).toBe(
      'e3b0c44298fc1c149afbf4c8996fb924' +
      '27ae41e4649b934ca495991b7852b855'
    );
  });

  it('should hash the raw bytes and not only text characters', async () => {
    const bytes = new Uint8Array([
      0,
      1,
      2,
      3,
      255,
    ]);

    const file = new File(
      [bytes],
      'binary.igc'
    );

    const result = await service.calculateFileHash(file);

    const expectedBuffer = await crypto.subtle.digest(
      'SHA-256',
      bytes
    );

    const expectedHash = Array.from(
      new Uint8Array(expectedBuffer)
    )
      .map((byte) =>
        byte.toString(16).padStart(2, '0')
      )
      .join('');

    expect(result).toBe(expectedHash);
  });
});