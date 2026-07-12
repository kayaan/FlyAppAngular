import { beforeEach, describe, expect, it } from 'vitest';

import { IgcParserService } from './igc-parser.service';

describe('IgcParserService', () => {
  let service: IgcParserService;

  beforeEach(() => {
    service = new IgcParserService();
  });

  it('should parse metadata and valid B records', () => {
    const igc = [
      'AXXX123',
      'HFDTE010625',
      'HFPLTPILOT:Max Mustermann',
      'HFGTYGLIDERTYPE:Advance Sigma 11',
      'B0951293746220N03004882EA0185901897',
      'B0951393746230N03004892EA0186901907',
    ].join('\n');

    const result = service.parse(igc);

    expect(result.meta).toEqual({
      date: '2025-06-01',
      pilot: 'Max Mustermann',
      glider: 'Advance Sigma 11',
    });

    expect(Array.from(result.track.timeSec)).toEqual([
      9 * 3600 + 51 * 60 + 29,
      9 * 3600 + 51 * 60 + 39,
    ]);

    expect(Array.from(result.track.latE7)).toEqual([
      377_703_333,
      377_705_000,
    ]);

    expect(Array.from(result.track.lonE7)).toEqual([
      300_813_667,
      300_815_333,
    ]);

    expect(Array.from(result.track.altBaroCm)).toEqual([
      185_900,
      186_900,
    ]);

    expect(Array.from(result.track.altGpsCm)).toEqual([
      189_700,
      190_700,
    ]);
  });

  it('should parse pilot in charge header', () => {
    const result = service.parse(
      'HFPLTPILOTINCHARGE:Erika Musterfrau'
    );

    expect(result.meta.pilot).toBe('Erika Musterfrau');
  });

  it('should prefer glider type over glider id', () => {
    const igc = [
      'HFGIDGLIDERID:D-1234',
      'HFGTYGLIDERTYPE:Ozone Enzo 3',
    ].join('\n');

    const result = service.parse(igc);

    expect(result.meta.glider).toBe('Ozone Enzo 3');
  });

  it('should use glider id when no glider type exists', () => {
    const result = service.parse(
      'HFGIDGLIDERID:D-1234'
    );

    expect(result.meta.glider).toBe('D-1234');
  });

  it('should parse alternate date header formats', () => {
    expect(service.parse('HFDTEDATE:010625').meta.date)
      .toBe('2025-06-01');

    expect(service.parse('HFDTE010625,01').meta.date)
      .toBe('2025-06-01');
  });

  it('should interpret years from 80 to 99 as 1900 dates', () => {
    expect(service.parse('HFDTE311299').meta.date)
      .toBe('1999-12-31');

    expect(service.parse('HFDTE010180').meta.date)
      .toBe('1980-01-01');
  });

  it('should interpret years below 80 as 2000 dates', () => {
    expect(service.parse('HFDTE010179').meta.date)
      .toBe('2079-01-01');

    expect(service.parse('HFDTE010100').meta.date)
      .toBe('2000-01-01');
  });

  it('should ignore an invalid date', () => {
    expect(service.parse('HFDTE321225').meta.date)
      .toBeUndefined();

    expect(service.parse('HFDTE010025').meta.date)
      .toBeUndefined();

    expect(service.parse('HFDTEINVALID').meta.date)
      .toBeUndefined();
  });

  it('should trim metadata values', () => {
    const igc = [
      'HFPLTPILOT:   Max Mustermann   ',
      'HFGTYGLIDERTYPE:   Nova Mentor   ',
    ].join('\n');

    const result = service.parse(igc);

    expect(result.meta.pilot).toBe('Max Mustermann');
    expect(result.meta.glider).toBe('Nova Mentor');
  });

  it('should return undefined for empty metadata values', () => {
    const igc = [
      'HFPLTPILOT:   ',
      'HFGTYGLIDERTYPE:   ',
    ].join('\n');

    const result = service.parse(igc);

    expect(result.meta.pilot).toBeUndefined();
    expect(result.meta.glider).toBeUndefined();
  });

  it('should parse southern and western coordinates as negative', () => {
    const result = service.parse(
      'B0951293746220S03004882WA0185901897'
    );

    expect(result.track.latE7[0]).toBe(-377_703_333);
    expect(result.track.lonE7[0]).toBe(-300_813_667);
  });

  it('should parse negative altitudes', () => {
    const result = service.parse(
      'B0951293746220N03004882EA-0050-0025'
    );

    expect(result.track.altBaroCm[0]).toBe(-5_000);
    expect(result.track.altGpsCm[0]).toBe(-2_500);
  });

  it('should ignore invalid B records', () => {
    const igc = [
      'B123',
      'B0951293746220N03004882EV0185901897',
      'B0951293746220X03004882EA0185901897',
      'B0951293746220N03004882XA0185901897',
      'BXX51293746220N03004882EA0185901897',
      'B095129INVALIDN03004882EA0185901897',
      'B0951293746220NINVALID0EA0185901897',
      'B0951293746220N03004882EAABCDE01897',
    ].join('\n');

    const result = service.parse(igc);

    expect(result.track.timeSec.length).toBe(0);
    expect(result.track.latE7.length).toBe(0);
    expect(result.track.lonE7.length).toBe(0);
    expect(result.track.altGpsCm.length).toBe(0);
    expect(result.track.altBaroCm.length).toBe(0);
  });

  it('should ignore unrelated and empty lines', () => {
    const igc = [
      '',
      'AXXX123',
      'C1234567N12345678E',
      'LXXX Some logger information',
      '',
      'B0951293746220N03004882EA0185901897',
      '',
    ].join('\r\n');

    const result = service.parse(igc);

    expect(result.track.timeSec.length).toBe(1);
  });

  it('should return empty typed arrays for empty input', () => {
    const result = service.parse('');

    expect(result.meta).toEqual({});

    expect(result.track.timeSec).toBeInstanceOf(Int32Array);
    expect(result.track.latE7).toBeInstanceOf(Int32Array);
    expect(result.track.lonE7).toBeInstanceOf(Int32Array);
    expect(result.track.altGpsCm).toBeInstanceOf(Int32Array);
    expect(result.track.altBaroCm).toBeInstanceOf(Int32Array);

    expect(result.track.timeSec.length).toBe(0);
    expect(result.track.latE7.length).toBe(0);
    expect(result.track.lonE7.length).toBe(0);
    expect(result.track.altGpsCm.length).toBe(0);
    expect(result.track.altBaroCm.length).toBe(0);
  });

  it('should let the last pilot header win', () => {
    const igc = [
      'HFPLTPILOT:First Pilot',
      'HFPLTPILOTINCHARGE:Second Pilot',
    ].join('\n');

    const result = service.parse(igc);

    expect(result.meta.pilot).toBe('Second Pilot');
  });
});