// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '../store/useGame.js';
import { InscribeHandoff, encodeVoucher, parseHandoff } from './InscribeHandoff.js';

afterEach(cleanup);

const SKY = 'https://sky.theamarium.com';
const WALLET = '0x1111111111111111111111111111111111111111';
const RETURN = `${SKY}/claim`;

const response = {
  voucher: {
    tokenId: '0',
    to: WALLET,
    creatureId: '0x' + '22'.repeat(32),
    metadataHash: '0x' + '33'.repeat(32),
    deadline: 1_700_000_900,
  },
  signature: '0xabc',
  domain: { name: 'Star', version: '1', chainId: 4663, verifyingContract: WALLET },
  signer: WALLET,
  metadata: {
    name: 'Pip',
    bornAt: 1,
    graduatedAt: 2,
    finalTraits: { warmth: 0.9 },
    constellationPos: { x: 0.1, y: 0.2 },
  },
};

describe('parseHandoff — only the Sky may receive a voucher', () => {
  it('accepts a well-formed handoff and defaults the seat to a new star', () => {
    const r = parseHandoff(`?star=s1&to=${WALLET}&return=${encodeURIComponent(RETURN)}`, SKY);
    expect(r).toEqual({
      ok: true,
      params: { star: 's1', to: WALLET, tokenId: '0', returnTo: RETURN },
    });
    const seat = parseHandoff(`?star=s1&to=${WALLET}&seat=7&return=${RETURN}`, SKY);
    expect(seat.ok && seat.params.tokenId).toBe('7');
  });

  it('refuses anything that is not the Sky, a wallet, a seat, or a star', () => {
    const bad = (q: string) => {
      const r = parseHandoff(q, SKY);
      return r.ok ? 'ok' : r.error;
    };
    expect(bad(`?star=s1&to=${WALLET}&return=https://evil.example/claim`)).toMatch(/Sky/);
    expect(bad(`?star=s1&to=${WALLET}&return=${SKY}.evil.example/claim`)).toMatch(/Sky/);
    expect(bad(`?star=s1&to=nope&return=${RETURN}`)).toMatch(/wallet/);
    expect(bad(`?star=s1&to=${WALLET}&seat=x&return=${RETURN}`)).toMatch(/seat/);
    expect(bad(`?to=${WALLET}&return=${RETURN}`)).toMatch(/star/);
    const noSky = parseHandoff(`?star=s1&to=${WALLET}&return=${RETURN}`, undefined);
    expect(!noSky.ok && noSky.error).toMatch(/no Sky/);
  });
});

describe('<InscribeHandoff>', () => {
  it('asks the API for the voucher and carries it back to the Sky in the fragment', async () => {
    const inscribeStar = vi.fn().mockResolvedValue(response);
    useGame.setState({ client: { inscribeStar } as never });
    const navigate = vi.fn();
    render(
      <InscribeHandoff
        params={{ star: 's1', to: WALLET, tokenId: '7', returnTo: RETURN }}
        navigate={navigate}
      />,
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(inscribeStar).toHaveBeenCalledWith('s1', { to: WALLET, tokenId: '7' });
    const url = navigate.mock.calls[0]![0] as string;
    expect(url.startsWith(`${RETURN}#v=`)).toBe(true);
    const encoded = url.slice(`${RETURN}#v=`.length);
    expect(encoded).toBe(encodeVoucher(response));
    expect(encoded).not.toMatch(/[+/=]/);
    const json = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    expect(JSON.parse(json)).toEqual(response);
  });

  it('says so, gently, when the glass will not vouch', async () => {
    useGame.setState({
      client: { inscribeStar: vi.fn().mockRejectedValue(new Error('404')) } as never,
    });
    const navigate = vi.fn();
    render(
      <InscribeHandoff
        params={{ star: 's1', to: WALLET, tokenId: '0', returnTo: RETURN }}
        navigate={navigate}
      />,
    );
    expect(await screen.findByText(/could not vouch/)).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
