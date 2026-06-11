import { useEffect, useMemo, useState } from 'react';

import { generateLegalMoves } from '../../game/legality';
import { getPieceAt } from '../../game/initialState';
import { samePosition } from '../../game/types';
import type { Move, Position } from '../../game/types';
import type { OnlineConnectionState } from '../reducer';
import type { Role, RoomParticipant, RoomSnapshot } from '../types';

type UseOnlineGameOptions = {
  snapshot: RoomSnapshot | null;
  connectionState: OnlineConnectionState;
  needsResync: boolean;
  role?: Role | null;
  participantId?: string | null;
  onMove: (move: Move) => void;
};

function findParticipant(
  snapshot: RoomSnapshot | null,
  participantId?: string | null,
  role?: Role | null,
): RoomParticipant | null {
  if (!snapshot) {
    return null;
  }

  if (participantId) {
    return snapshot.participants.find((participant) => participant.participantId === participantId) ?? null;
  }

  if (role) {
    return snapshot.participants.find((participant) => participant.role === role) ?? null;
  }

  return null;
}

export function useOnlineGame({
  snapshot,
  connectionState,
  needsResync,
  role = null,
  participantId = null,
  onMove,
}: UseOnlineGameOptions) {
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<Position[]>([]);

  const participant = useMemo(
    () => findParticipant(snapshot, participantId, role),
    [participantId, role, snapshot],
  );
  const playerSide = participant?.seat ?? null;
  const match = snapshot?.match ?? null;
  const authoritativeState = match?.state ?? null;
  const canControlTurn =
    connectionState === 'connected' &&
    !needsResync &&
    authoritativeState !== null &&
    playerSide !== null &&
    authoritativeState.currentSide === playerSide &&
    authoritativeState.gameOver === null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedPieceId(null);
    setLegalTargets([]);
  }, [match?.revision]);

  const displayState = useMemo(() => {
    if (!authoritativeState) {
      return null;
    }

    return {
      ...authoritativeState,
      selectedPieceId,
      legalTargets,
    };
  }, [authoritativeState, legalTargets, selectedPieceId]);

  function handleSquareClick(position: Position): void {
    if (!authoritativeState || !canControlTurn || !playerSide) {
      return;
    }

    if (selectedPieceId) {
      const selectedMove = generateLegalMoves(authoritativeState, selectedPieceId).find((move) =>
        samePosition(move.to, position),
      );

      if (selectedMove) {
        setSelectedPieceId(null);
        setLegalTargets([]);
        onMove(selectedMove);
        return;
      }
    }

    const clickedPiece = getPieceAt(authoritativeState, position);

    if (clickedPiece?.side === playerSide) {
      const moves = generateLegalMoves(authoritativeState, clickedPiece.id);
      setSelectedPieceId(clickedPiece.id);
      setLegalTargets(moves.map((move) => move.to));
      return;
    }

    setSelectedPieceId(null);
    setLegalTargets([]);
  }

  return {
    displayState,
    match,
    participant,
    playerSide,
    isSpectator: playerSide === null,
    canControlTurn,
    handleSquareClick,
  };
}
