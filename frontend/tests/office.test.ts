import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canEnterGridCell, facingForStep, projectGrid, unprojectWorld, validateOfficeAssets, validateOfficeMap } from '../src/office/domain';
import type { OfficeAssets, OfficeMap } from '../src/office/types';

const mapFixture = () => JSON.parse(readFileSync(new URL('../public/assets/office/office-map.v0.3.json', import.meta.url), 'utf8')) as OfficeMap;
const assetFixture = () => JSON.parse(readFileSync(new URL('../public/assets/office/office-assets.v0.3.json', import.meta.url), 'utf8')) as OfficeAssets;

describe('M1 white-box office domain contracts', () => {
  it('WB-M1-01 round-trips isometric projection without applying DPR', () => {
    const map = mapFixture();
    for (const point of [{ col: 0, row: 0 }, { col: 7, row: 13 }, { col: 31, row: 23 }]) {
      const world = projectGrid(point, map);
      expect(unprojectWorld(world, map)).toEqual(point);
      expect(projectGrid(point, map)).toEqual(world);
    }
  });

  it.each([
    [{ col: 2, row: 2 }, { col: 3, row: 2 }, 'SE'],
    [{ col: 2, row: 2 }, { col: 1, row: 2 }, 'NW'],
    [{ col: 2, row: 2 }, { col: 2, row: 3 }, 'SW'],
    [{ col: 2, row: 2 }, { col: 2, row: 1 }, 'NE'],
  ] as const)('WB-M1-01 maps four-neighbor direction %j -> %j to %s', (from, to, facing) => {
    expect(facingForStep(from, to)).toBe(facing);
  });

  it('WB-M1-01 rejects diagonal, zero-length and multi-cell steps', () => {
    expect(() => facingForStep({ col: 0, row: 0 }, { col: 1, row: 1 })).toThrow(/四邻接/);
    expect(() => facingForStep({ col: 0, row: 0 }, { col: 0, row: 0 })).toThrow(/四邻接/);
    expect(() => facingForStep({ col: 0, row: 0 }, { col: 2, row: 0 })).toThrow(/四邻接/);
  });

  it('WB-M1-02 prevents same-cell claims and opposite edge swaps', () => {
    const base = { id: 'a', cell: { col: 1, row: 1 }, phase: 'walking', segmentFrom: { col: 1, row: 1 }, segmentTo: { col: 2, row: 1 } };
    expect(canEnterGridCell('a', base.cell, { col: 2, row: 1 }, [base])).toBe(true);
    expect(canEnterGridCell('a', base.cell, { col: 2, row: 1 }, [base,
      { id: 'b', cell: { col: 2, row: 1 }, phase: 'standing', segmentFrom: { col: 2, row: 1 }, segmentTo: { col: 2, row: 1 } }])).toBe(false);
    expect(canEnterGridCell('a', base.cell, { col: 2, row: 1 }, [base,
      { id: 'b', cell: { col: 2, row: 1 }, phase: 'walking', segmentFrom: { col: 2, row: 1 }, segmentTo: { col: 1, row: 1 } }])).toBe(false);
    expect(canEnterGridCell('a', base.cell, { col: 2, row: 1 }, [base,
      { id: 'b', cell: { col: 3, row: 1 }, phase: 'walking', segmentFrom: { col: 3, row: 1 }, segmentTo: { col: 2, row: 1 } }])).toBe(false);
    expect(canEnterGridCell('a', base.cell, { col: 3, row: 1 }, [base])).toBe(false);
  });
  it('WB-M1-01 accepts the approved runtime map and asset manifest', () => {
    expect(validateOfficeMap(mapFixture()).mapRevision).toBeTruthy();
    expect(validateOfficeAssets(assetFixture()).rightsReview.status).toBe('approved');
  });

  it.each([
    (map: OfficeMap) => { map.origin.x = Number.NaN; },
    (map: OfficeMap) => { map.collision[0] = `2${map.collision[0].slice(1)}`; },
    (map: OfficeMap) => { map.anchors[1].id = map.anchors[0].id; },
    (map: OfficeMap) => { map.anchors[0].approach = { col: -1, row: 0 }; },
    (map: OfficeMap) => { const point = map.anchors[0].approach; map.collision[point.row] = `${map.collision[point.row].slice(0, point.col)}1${map.collision[point.row].slice(point.col + 1)}`; },
  ])('WB-M1-01 rejects malformed map semantics', mutate => {
    const map = mapFixture();
    mutate(map);
    expect(() => validateOfficeMap(map)).toThrow(/办公室/);
  });

  it.each([
    (assets: OfficeAssets) => { assets.rightsReview.status = 'pending'; },
    (assets: OfficeAssets) => { assets.atlases[0].image = 'https://example.invalid/agents.png'; },
    (assets: OfficeAssets) => { assets.atlases[0].frames[1].id = assets.atlases[0].frames[0].id; },
    (assets: OfficeAssets) => { assets.atlases[0].frames[0].x = assets.atlases[0].width; },
    (assets: OfficeAssets) => { assets.animations[0].frameIds = ['missing-frame']; },
  ])('WB-M1-01 rejects unsafe or inconsistent asset semantics', mutate => {
    const assets = assetFixture();
    mutate(assets);
    expect(() => validateOfficeAssets(assets)).toThrow(/办公室/);
  });
});
