import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Move } from '../game/types';
import { MoveList } from './MoveList';

const moves: Move[] = [
  {
    id: 'red-cannon:7,1-7,4',
    pieceId: 'red-cannon-left',
    pieceType: 'cannon',
    side: 'red',
    from: { row: 7, col: 1 },
    to: { row: 7, col: 4 },
  },
  {
    id: 'black-cannon:2,7-9,7',
    pieceId: 'black-cannon-right',
    pieceType: 'cannon',
    side: 'black',
    from: { row: 2, col: 7 },
    to: { row: 9, col: 7 },
  },
];

describe('MoveList', () => {
  afterEach(() => {
    cleanup();
  });

  it('highlights the most recent move', () => {
    render(<MoveList moves={moves} />);

    const items = screen.getAllByRole('listitem');

    expect(items[0]).not.toHaveClass('is-latest');
    expect(items[1]).toHaveClass('is-latest');
    expect(items[0]).toHaveTextContent('炮八平五');
    expect(items[1]).toHaveTextContent('炮八进七');
  });
});
