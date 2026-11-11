import { supabase } from './supabase';

async function checkAndAwardTrophies(userId: string, newScore: number) {
  try {
    const { count: totalGames } = await supabase
      .from('arcade_scores')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { data: unlockedTrophies } = await supabase
      .from('user_trophies')
      .select('trophy_id')
      .eq('user_id', userId);

    const unlockedIds = new Set((unlockedTrophies || []).map((t: any) => t.trophy_id));

    const trophiesToCheck = [
      { id: 'first_game', condition: (totalGames || 0) >= 1, name: 'Primo Contatto' },
      { id: 'score_1000', condition: newScore >= 1000, name: 'Veterano Arcade (1000+ Pts)' },
      { id: 'score_5000', condition: newScore >= 5000, name: 'Maestro Cibernetico (5000+ Pts)' },
    ];

    for (const trophy of trophiesToCheck) {
      if (trophy.condition && !unlockedIds.has(trophy.id)) {
        const { error } = await supabase.from('user_trophies').insert({
          user_id: userId,
          trophy_id: trophy.id
        });
        if (!error) {
          console.log(`🏆 Trofeo Sbloccato: ${trophy.name}`);
        }
      }
    }
  } catch (err) {
    console.error("Errore checkAndAwardTrophies:", err);
  }
}

async function saveToGlobalArcadeScores(userId: string, gameId: string, playDate: string, score: number) {
  try {
    const { data: existing } = await supabase
      .from('arcade_scores')
      .select('*')
      .eq('user_id', userId)
      .eq('play_date', playDate)
      .eq('game_id', gameId)
      .maybeSingle();

    if (existing) {
      if (score > existing.score) {
        await supabase.from('arcade_scores').update({ score }).eq('id', existing.id);
      }
    } else {
      await supabase.from('arcade_scores').insert({
        user_id: userId,
        play_date: playDate,
        game_id: gameId,
        score,
      });
    }

    // Check trophies after saving arcade score
    await checkAndAwardTrophies(userId, score);
  } catch (err) {
    console.error("Errore salvataggio arcade_scores globale:", err);
  }
}

export async function handleGameScoreSubmission({
  gameId,
  rawScore,
  routeParams,
}: {
  gameId: string;
  rawScore: number;
  routeParams?: { isRoomMode?: boolean; roomId?: string; playDate?: string };
}) {
  let computedFinalScore = rawScore;
  let activeMultiplier = 0;
  let statusMessage = '';
  let attemptsUsed = 0;
  let practiceUsed = false;
  let isTrainingMode = false;

  try {
    let user = null;
    try {
      const authRes = await supabase.auth.getUser();
      user = authRes.data.user;
    } catch (authErr) {
      console.error("Errore autenticazione offline:", authErr);
      return {
        computedFinalScore,
        activeMultiplier,
        statusMessage: "CONNESSIONE ASSENTE: Impossibile sincronizzare il punteggio offline.",
        attemptsUsed,
        practiceUsed,
        isTrainingMode: true
      };
    }

    if (!user) {
      return { 
        computedFinalScore, 
        activeMultiplier, 
        statusMessage: 'CONNESSIONE ASSENTE: Utente non autenticato o offline.', 
        attemptsUsed, 
        practiceUsed, 
        isTrainingMode: true 
      };
    }

    const isRoomMode = routeParams?.isRoomMode;
    const roomId = routeParams?.roomId;
    const playDate = routeParams?.playDate || new Date().toISOString().split('T')[0];

    // 1. Controllo Modalità Allenamento / Free Practice
    if (!isRoomMode) {
      isTrainingMode = true;
      activeMultiplier = 0;
      statusMessage = "MODALITÀ ALLENAMENTO - NESSUN MOLTIPLICATORE APPLICATO";
      computedFinalScore = rawScore;
      
      await saveToGlobalArcadeScores(user.id, gameId, playDate, computedFinalScore);
      return { computedFinalScore, activeMultiplier, statusMessage, attemptsUsed, practiceUsed, isTrainingMode };
    }

    // 2. Se isRoomMode è TRUE, leggi il bonus turbina da profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_game_multiplier')
      .eq('id', user.id)
      .maybeSingle();
    
    const multi = profile?.current_game_multiplier || 0;
    activeMultiplier = multi;

    if (multi > 0) {
      computedFinalScore = Math.floor(rawScore * (1 + (multi / 100)));
    }

    if (!roomId) {
      statusMessage = "ERRORE: ID Stanza mancante";
      await saveToGlobalArcadeScores(user.id, gameId, playDate, computedFinalScore);
      return { computedFinalScore, activeMultiplier, statusMessage, attemptsUsed, practiceUsed, isTrainingMode };
    }

    // Leggi il record attuale dell'utente in game_room_scores
    const { data: existingRoomScore, error: fetchError } = await supabase
      .from('game_room_scores')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .eq('game_id', gameId)
      .eq('play_date', playDate)
      .maybeSingle();

    if (fetchError) {
      console.error("Errore fetch game_room_scores:", fetchError);
    }

    if (!existingRoomScore) {
      practiceUsed = true;
      attemptsUsed = 0;
      const highestScore = computedFinalScore;

      const { error: insertError } = await supabase.from('game_room_scores').insert({
        room_id: roomId,
        user_id: user.id,
        game_id: gameId,
        play_date: playDate,
        highest_score: highestScore,
        practice_used: true,
        attempts_used: 0
      });

      if (insertError) {
        console.error("ERRORE INSERIMENTO PUNTEGGIO:", insertError);
      }

      await saveToGlobalArcadeScores(user.id, gameId, playDate, computedFinalScore);

      statusMessage = "PROVA COMPLETATA (0/5 TENTATIVI USATI)";
      return { computedFinalScore, activeMultiplier, statusMessage, attemptsUsed, practiceUsed, isTrainingMode };
    }

    practiceUsed = existingRoomScore.practice_used ?? false;
    attemptsUsed = existingRoomScore.attempts_used ?? 0;
    const currentHighest = existingRoomScore.highest_score || 0;

    if (!practiceUsed) {
      practiceUsed = true;
      const newHighest = Math.max(currentHighest, computedFinalScore);
      const { error: updateError1 } = await supabase.from('game_room_scores').update({
        practice_used: true,
        highest_score: newHighest
      }).eq('id', existingRoomScore.id);

      if (updateError1) {
        console.error("ERRORE AGGIORNAMENTO PUNTEGGIO:", updateError1);
      }

      await saveToGlobalArcadeScores(user.id, gameId, playDate, computedFinalScore);

      statusMessage = "PROVA COMPLETATA (0/5 TENTATIVI USATI)";
      return { computedFinalScore, activeMultiplier, statusMessage, attemptsUsed, practiceUsed, isTrainingMode };
    }

    if (attemptsUsed >= 5) {
      statusMessage = "TENTATIVI ESAURITI PER OGGI (5/5)";
      await saveToGlobalArcadeScores(user.id, gameId, playDate, computedFinalScore);
      return { computedFinalScore, activeMultiplier, statusMessage, attemptsUsed, practiceUsed, isTrainingMode };
    }

    const threshold = currentHighest * 0.5;
    const isValidAttempt = computedFinalScore >= threshold || currentHighest === 0;

    if (isValidAttempt) {
      attemptsUsed += 1;
      const newHighest = Math.max(currentHighest, computedFinalScore);
      const { error: updateError2 } = await supabase.from('game_room_scores').update({
        attempts_used: attemptsUsed,
        highest_score: newHighest
      }).eq('id', existingRoomScore.id);

      if (updateError2) {
        console.error("ERRORE AGGIORNAMENTO PUNTEGGIO:", updateError2);
      }

      statusMessage = `TENTATIVO REGISTRATO (${attemptsUsed}/5 TENTATIVI USATI)`;
    } else {
      // Salva comunque il punteggio se supera il precedente highest_score, ma non consuma tentativi
      const newHighest = Math.max(currentHighest, computedFinalScore);
      if (newHighest !== currentHighest) {
        const { error: updateError3 } = await supabase.from('game_room_scores').update({
          highest_score: newHighest
        }).eq('id', existingRoomScore.id);

        if (updateError3) {
          console.error("ERRORE AGGIORNAMENTO PUNTEGGIO:", updateError3);
        }
      }
      statusMessage = `Punteggio troppo basso. Tentativo non consumato. (${attemptsUsed}/5 TENTATIVI USATI)`;
    }

    await saveToGlobalArcadeScores(user.id, gameId, playDate, computedFinalScore);

  } catch (error: any) {
    console.error("Errore salvataggio punteggio stanza / offline:", error);
    statusMessage = "CONNESSIONE ASSENTE: Impossibile sincronizzare il punteggio offline.";
  }

  return { computedFinalScore, activeMultiplier, statusMessage, attemptsUsed, practiceUsed, isTrainingMode };
}
