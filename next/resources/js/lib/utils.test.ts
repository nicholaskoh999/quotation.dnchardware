import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
    it('merges tailwind classes, last wins', () => {
        expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });
    it('drops falsy values', () => {
        expect(cn('a', false, null, undefined, 'b')).toBe('a b');
    });
});
