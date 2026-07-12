import { provideHttpClient } from '@angular/common/http';
import {
    HttpTestingController,
    provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import {
    PublicFlight,
    PublicFlightDetailsDto,
    PublicFlightsPage,
} from '../models/public-flight.model';
import { PublicFlightsApiService } from './public-flights-api.service';

describe('PublicFlightsApiService', () => {
    let service: PublicFlightsApiService;
    let httpTesting: HttpTestingController;

    beforeEach(() => {
        TestBed.resetTestingModule();

        TestBed.configureTestingModule({
            providers: [
                PublicFlightsApiService,
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        });

        service = TestBed.inject(PublicFlightsApiService);
        httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpTesting.verify();
        TestBed.resetTestingModule();
    });

    it('should load public flights without query parameters', () => {
        const expectedPage: PublicFlightsPage = {
            items: [],
            page: 0,
            size: 50,
            totalItems: 0,
            totalPages: 0,
        };

        service.getPublicFlights().subscribe((result) => {
            expect(result).toEqual(expectedPage);
        });

        const request = httpTesting.expectOne(
            (candidate) =>
                candidate.url === '/api/public/flights' &&
                candidate.params.keys().length === 0,
        );

        expect(request.request.method).toBe('GET');

        request.flush(expectedPage);
    });

    it('should send all supported query parameters', () => {
        const expectedPage: PublicFlightsPage = {
            items: [],
            page: 2,
            size: 25,
            totalItems: 100,
            totalPages: 4,
        };

        service
            .getPublicFlights({
                q: '  max mustermann  ',
                from: '2026-06-01',
                to: '2026-07-12',
                sort: 'distance',
                direction: 'desc',
                page: 2,
                size: 25,
            })
            .subscribe((result) => {
                expect(result).toEqual(expectedPage);
            });

        const request = httpTesting.expectOne(
            (candidate) => candidate.url === '/api/public/flights',
        );

        expect(request.request.method).toBe('GET');
        expect(request.request.params.get('q')).toBe('max mustermann');
        expect(request.request.params.get('from')).toBe('2026-06-01');
        expect(request.request.params.get('to')).toBe('2026-07-12');
        expect(request.request.params.get('sort')).toBe('distance');
        expect(request.request.params.get('direction')).toBe('desc');
        expect(request.request.params.get('page')).toBe('2');
        expect(request.request.params.get('size')).toBe('25');

        request.flush(expectedPage);
    });

    it('should omit an empty search value', () => {
        service
            .getPublicFlights({
                q: '   ',
            })
            .subscribe();

        const request = httpTesting.expectOne('/api/public/flights');

        expect(request.request.method).toBe('GET');
        expect(request.request.params.has('q')).toBe(false);

        request.flush(createEmptyPage());
    });

    it('should omit null date filters', () => {
        service
            .getPublicFlights({
                from: null,
                to: null,
            })
            .subscribe();

        const request = httpTesting.expectOne('/api/public/flights');

        expect(request.request.method).toBe('GET');
        expect(request.request.params.has('from')).toBe(false);
        expect(request.request.params.has('to')).toBe(false);

        request.flush(createEmptyPage());
    });

    it('should preserve page and size zero', () => {
        service
            .getPublicFlights({
                page: 0,
                size: 0,
            })
            .subscribe();

        const request = httpTesting.expectOne(
            (candidate) =>
                candidate.method === 'GET' &&
                candidate.urlWithParams === '/api/public/flights?page=0&size=0',
        );

        // Request zuerst abschließen, damit verify() keinen Folgefehler erzeugt.
        request.flush(createEmptyPage());

        expect(request.request.params.get('page')).toBe('0');
        expect(request.request.params.get('size')).toBe('0');
    });

    it('should load public flight details', () => {
        const flight = createPublicFlight('flight-1');

        const expectedDetails: PublicFlightDetailsDto = {
            flight,
            track: {
                timeSec: [100, 110],
                latE7: [480_000_000, 480_001_000],
                lonE7: [110_000_000, 110_001_000],
                altGpsCm: [50_000, 51_000],
                altBaroCm: [49_000, 50_000],
            },
        };

        service
            .getPublicFlightDetails('flight-1')
            .subscribe((result) => {
                expect(result).toEqual(expectedDetails);
            });

        const request = httpTesting.expectOne(
            '/api/public/flights/flight-1/details',
        );

        expect(request.request.method).toBe('GET');
        expect(request.request.params.keys()).toEqual([]);

        request.flush(expectedDetails);
    });
});

function createEmptyPage(): PublicFlightsPage {
    return {
        items: [],
        page: 0,
        size: 0,
        totalItems: 0,
        totalPages: 0,
    };
}

function createPublicFlight(id: string): PublicFlight {
    return {
        id,
        fileName: `${id}.igc`,
        flightDate: '2026-07-01',
        pilot: 'Test Pilot',
        glider: 'Test Glider',
        importedAtUtc: '2026-07-01T12:00:00Z',

        startIndex: 0,
        endIndex: 1,
        fixCount: 2,

        startTimeSec: 100,
        endTimeSec: 110,
        durationSec: 10,

        distanceM: 1_000,

        minAltGpsM: 500,
        maxAltGpsM: 510,
        gainGpsM: 10,

        minAltBaroM: 490,
        maxAltBaroM: 500,
        gainBaroM: 10,

        minLatE7: 480_000_000,
        maxLatE7: 480_001_000,
        minLonE7: 110_000_000,
        maxLonE7: 110_001_000,

        startLatE7: 480_000_000,
        startLonE7: 110_000_000,
        endLatE7: 480_001_000,
        endLonE7: 110_001_000,
    };
}