import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/initialState';
import { CharacterStage } from './CharacterStage';

describe('CharacterStage', () => {
  afterEach(() => {
    cleanup();
  });

  it('highlights the player portrait when it is the player turn', () => {
    render(<CharacterStage state={createInitialGameState()} aiThinking={false} />);

    expect(screen.getByText('鸣人').closest('.character-card')).toHaveClass('is-active');
    expect(screen.getByText('佐助').closest('.character-card')).not.toHaveClass('is-active');
    expect(screen.getByText('行动中')).toBeInTheDocument();
  });

  it('highlights the computer portrait while the AI is thinking', () => {
    render(
      <CharacterStage
        state={{
          ...createInitialGameState(),
          currentSide: 'black',
        }}
        aiThinking
      />,
    );

    const aiCard = screen.getByText('佐助').closest('.character-card');

    expect(aiCard).toHaveClass('is-thinking');
    expect(screen.getByText('思考中')).toBeInTheDocument();
  });

  it('does not render the old shoulder arcs under the portraits', () => {
    const { container } = render(<CharacterStage state={createInitialGameState()} aiThinking={false} />);
    const svgMarkup = container.querySelector('.character-stage')?.innerHTML ?? '';

    expect(svgMarkup).not.toContain('M72 192c10-22 28-36 50-36 22 0 40 14 50 36');
    expect(svgMarkup).not.toContain('M84 187c8-10 20-16 38-16 17 0 29 5 37 16');
    expect(svgMarkup).not.toContain('M74 192c9-22 28-36 49-36s39 14 49 36');
    expect(svgMarkup).not.toContain('M86 187c9-10 21-15 37-15 17 0 29 5 37 15');
  });
});
