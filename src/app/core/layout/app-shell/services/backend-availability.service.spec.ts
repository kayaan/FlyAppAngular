import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BackendAvailabilityService } from './backend-availability.service';

describe('BackendAvailabilityService', () => {
    let service: BackendAvailabilityService;

    beforeEach(() => {
        service = new BackendAvailabilityService();

        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should initially be unchecked and unavailable', () => {
        expect(service.checked()).toBe(false);
        expect(service.available()).toBe(false);
    });

    it('should return true for a successful backend response', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(
                new Response(null, {
                    status: 200,
                })
            );

        const result = await service.check();

        expect(result).toBe(true);
        expect(service.checked()).toBe(true);
        expect(service.available()).toBe(true);

        expect(fetchSpy).toHaveBeenCalledWith('/api/me', {
            method: 'GET',
            credentials: 'include',
            signal: expect.any(AbortSignal),
        });
    });

    it.each([401, 403, 302])(
        'should consider status %s as backend available',
        async (status) => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(null, {
                    status,
                })
            );

            const result = await service.check();

            expect(result).toBe(true);
            expect(service.checked()).toBe(true);
            expect(service.available()).toBe(true);
        }
    );

    it.each([500, 502, 503])(
        'should consider status %s as backend unavailable',
        async (status) => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                new Response(null, {
                    status,
                })
            );

            const result = await service.check();

            expect(result).toBe(false);
            expect(service.checked()).toBe(true);
            expect(service.available()).toBe(false);
        }
    );

    it('should return false when fetch fails', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new TypeError('Failed to fetch')
        );

        const result = await service.check();

        expect(result).toBe(false);
        expect(service.checked()).toBe(true);
        expect(service.available()).toBe(false);
    });

    it('should cache the result after the first completed check', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValue(
                new Response(null, {
                    status: 200,
                })
            );

        const firstResult = await service.check();
        const secondResult = await service.check();

        expect(firstResult).toBe(true);
        expect(secondResult).toBe(true);

        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('should share one request between parallel checks', async () => {
        let resolveFetch!: (response: Response) => void;

        const fetchPromise = new Promise<Response>((resolve) => {
            resolveFetch = resolve;
        });

        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(fetchPromise);

        const firstCheck = service.check();
        const secondCheck = service.check();

        expect(fetchSpy).toHaveBeenCalledTimes(1);

        resolveFetch(
            new Response(null, {
                status: 200,
            })
        );

        await expect(firstCheck).resolves.toBe(true);
        await expect(secondCheck).resolves.toBe(true);

        expect(service.checked()).toBe(true);
        expect(service.available()).toBe(true);
    });

    it('should abort the request after 800 milliseconds', async () => {
        vi.useFakeTimers();

        let capturedSignal: AbortSignal | undefined;

        vi.spyOn(globalThis, 'fetch').mockImplementation(
            (_input, init) => {
                const signal = init?.signal;

                if (!(signal instanceof AbortSignal)) {
                    throw new Error('Expected an AbortSignal.');
                }

                capturedSignal = signal;

                return new Promise<Response>((_resolve, reject) => {
                    signal.addEventListener('abort', () => {
                        reject(
                            new DOMException(
                                'The operation was aborted.',
                                'AbortError'
                            )
                        );
                    });
                });
            }
        );

        const checkPromise = service.check();

        const signalBeforeTimeout = requireSignal(capturedSignal);

        expect(signalBeforeTimeout.aborted).toBe(false);

        await vi.advanceTimersByTimeAsync(800);

        await expect(checkPromise).resolves.toBe(false);

        const signalAfterTimeout = requireSignal(capturedSignal);

        expect(signalAfterTimeout.aborted).toBe(true);
        expect(service.checked()).toBe(true);
        expect(service.available()).toBe(false);
    });

    it('should clear the timeout after a successful request', async () => {
        vi.useFakeTimers();

        const clearTimeoutSpy = vi.spyOn(
            window,
            'clearTimeout'
        );

        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(null, {
                status: 200,
            })
        );

        await service.check();

        expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    });

    it('should clear the timeout after a failed request', async () => {
        vi.useFakeTimers();

        const clearTimeoutSpy = vi.spyOn(
            window,
            'clearTimeout'
        );

        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new Error('Network failure')
        );

        await service.check();

        expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    });

    it('should keep a failed result cached', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockRejectedValue(
                new Error('Backend unavailable')
            );

        const firstResult = await service.check();
        const secondResult = await service.check();

        expect(firstResult).toBe(false);
        expect(secondResult).toBe(false);

        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
});


function requireSignal(
  signal: AbortSignal | undefined
): AbortSignal {
  if (!signal) {
    throw new Error('AbortSignal was not captured.');
  }

  return signal;
}