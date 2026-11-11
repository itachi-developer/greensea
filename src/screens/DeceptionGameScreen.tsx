import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function DeceptionGameScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { roomId, userId, gameMode: initialGameMode } = route.params || {};

  const [gameState, setGameState] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [currentGameMode, setCurrentGameMode] = useState(initialGameMode || 'deception');
  const [myBluff, setMyBluff] = useState('');
  const [hasSubmittedBluff, setHasSubmittedBluff] = useState(false);
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPodiumModalVisible, setIsPodiumModalVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45);
  const [isSuspense, setIsSuspense] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scoreScale = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<any>(null);
  const suspenseTimerRef = useRef<any>(null);

  const triggerScreenShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const triggerScoreSpring = () => {
    scoreScale.setValue(1.25);
    Animated.spring(scoreScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (!roomId) return;

    fetchGameState();
    fetchPlayers();
    fetchRoomMode();

    const gameStateChannel = supabase
      .channel(`deception-game-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_game_state',
          filter: `room_id=eq.${roomId}`,
        },
        (payload: any) => {
          if (payload.new) {
            setGameState(payload.new);
            setIsSuspense(false);
            if (payload.new.game_phase === 'bluffing') {
              setHasSubmittedBluff(false);
              setMyBluff('');
              setTimeLeft(45);
            } else if (payload.new.game_phase === 'voting') {
              setHasVoted(false);
              setSelectedVote(null);
              setTimeLeft(30);
            } else if (payload.new.game_phase === 'scoring') {
              setTimeLeft(20);
              triggerScoreSpring();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_players',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchPlayers();
        }
      )
      .subscribe();

    const roomChannel = supabase
      .channel(`deception-room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'party_rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload: any) => {
          if (payload.new && payload.new.current_game) {
            setCurrentGameMode(payload.new.current_game);
          }
          if (!payload.new || payload.new.status === 'finished' || payload.new.status === 'closed') {
            Alert.alert('Protocollo Interrotto', "L'Host ha chiuso la stanza.");
            navigation.replace('Main');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(gameStateChannel);
      supabase.removeChannel(roomChannel);
      if (timerRef.current) clearInterval(timerRef.current);
      if (suspenseTimerRef.current) clearTimeout(suspenseTimerRef.current);
      shakeAnim.stopAnimation();
      scoreScale.stopAnimation();
    };
  }, [roomId]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          triggerScreenShake();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState?.game_phase]);

  const fetchGameState = async () => {
    const { data, error } = await supabase
      .from('party_game_state')
      .select('*')
      .eq('room_id', roomId)
      .single();

    if (!error && data) {
      setGameState(data);
    }
  };

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('party_players')
      .select('*')
      .eq('room_id', roomId);

    if (!error && data) {
      setPlayers(data);
    }
  };

  const fetchRoomMode = async () => {
    const { data } = await supabase
      .from('party_rooms')
      .select('current_game')
      .eq('id', roomId)
      .single();

    if (data && data.current_game) {
      setCurrentGameMode(data.current_game);
    }
  };

  const handleSubmitBluff = async () => {
    if (!myBluff.trim() || hasSubmittedBluff || !gameState) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const submissions = gameState.submissions || {};
    submissions[userId] = myBluff.trim();

    const { error } = await supabase
      .from('party_game_state')
      .update({ submissions })
      .eq('room_id', roomId);

    if (!error) {
      setHasSubmittedBluff(true);
      const totalPlayers = players.length;
      if (Object.keys(submissions).length >= totalPlayers) {
        advanceToVoting(submissions);
      }
    }
  };

  const advanceToVoting = async (currentSubmissions: any) => {
    const prompt = gameState.current_prompt;
    const choices = [
      { id: 'truth', text: prompt.truth, isTruth: true, authorId: null }
    ];

    Object.entries(currentSubmissions).forEach(([pId, text]) => {
      choices.push({ id: pId, text: text as string, isTruth: false, authorId: pId });
    });

    const shuffledChoices = choices.sort(() => Math.random() - 0.5);

    await supabase
      .from('party_game_state')
      .update({
        game_phase: 'voting',
        choices: shuffledChoices,
      })
      .eq('room_id', roomId);
  };

  const handleVote = async (choiceId: string) => {
    if (hasVoted || !gameState) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const votes = gameState.votes || {};
    votes[userId] = choiceId;

    const { error } = await supabase
      .from('party_game_state')
      .update({ votes })
      .eq('room_id', roomId);

    if (!error) {
      setHasVoted(true);
      setSelectedVote(choiceId);

      const totalPlayers = players.length;
      if (Object.keys(votes).length >= totalPlayers) {
        setIsSuspense(true);
        advanceToScoring(votes);
      }
    }
  };

  const advanceToScoring = async (currentVotes: any) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    let updatedPlayers = [...players];

    // Jackbox Fibbage scoring logic:
    // +1000 pts for guessing the truth
    // +500 pts for each vote received on your fake bluff (authorId)
    Object.entries(currentVotes).forEach(([voterId, votedChoiceId]) => {
      const voter = updatedPlayers.find(p => p.user_id === voterId);
      if (!voter) return;

      if (votedChoiceId === 'truth') {
        voter.score = (voter.score || 0) + 1000;
      } else {
        const author = updatedPlayers.find(p => p.user_id === votedChoiceId);
        if (author && author.user_id !== voterId) {
          author.score = (author.score || 0) + 500;
        }
      }
    });

    for (const p of updatedPlayers) {
      await supabase
        .from('party_players')
        .update({ score: p.score })
        .eq('id', p.id);
    }

    suspenseTimerRef.current = setTimeout(async () => {
      await supabase
        .from('party_game_state')
        .update({
          game_phase: 'scoring',
        })
        .eq('room_id', roomId);
    }, 2500);
  };

  const handleNextRound = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const currentRound = gameState.round_number || 1;
    const selectedPrompts = gameState.selected_prompts || [];

    if (currentRound >= 10) {
      setIsPodiumModalVisible(true);
      return;
    }

    const nextPrompt = selectedPrompts[currentRound] || selectedPrompts[0];

    await supabase
      .from('party_game_state')
      .update({
        round_number: currentRound + 1,
        game_phase: 'bluffing',
        current_prompt: nextPrompt,
        submissions: {},
        votes: {},
        choices: []
      })
      .eq('room_id', roomId);
  };

  const handleLeaveGame = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await supabase.from('party_players').delete().eq('room_id', roomId).eq('user_id', userId);
    const { data: roomData } = await supabase.from('party_rooms').select('host_id').eq('id', roomId).single();
    if (roomData && roomData.host_id === userId) {
      await supabase.from('party_rooms').update({ status: 'closed' }).eq('id', roomId);
    }
    navigation.replace('Main');
  };

  if (!gameState) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>CARICAMENTO PROTOCOLLO...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const phase = gameState.game_phase;
  const prompt = gameState.current_prompt || { text: 'Caricamento prompt...', truth: '' };
  const currentRound = gameState.round_number || 1;
  const isFinalRound = currentRound >= 10;
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  let gameTitleDisplay = 'DECEPTION';
  if (currentGameMode === 'naughty_fakin') gameTitleDisplay = "FAKIN' IT";
  else if (currentGameMode === 'naughty_drawful') gameTitleDisplay = 'DIRTY DRAWFUL';
  else if (currentGameMode === 'naughty_finish') gameTitleDisplay = 'LET ME FINISH';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <BlurView intensity={90} tint="dark" style={styles.header} pointerEvents="box-none">
        <TouchableOpacity style={styles.pauseButton} onPress={() => setIsPaused(true)}>
          <Ionicons name="pause" size={22} color="#00E5FF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{gameTitleDisplay} // ROUND {currentRound} DI 10</Text>
        <View style={styles.timerBadge}>
          <Ionicons name="time-outline" size={16} color="#FF0055" />
          <Text style={styles.timerText}>{timeLeft}s</Text>
        </View>
      </BlurView>

      <Animated.View style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}>
        <LinearGradient colors={['#050B14', '#121624']} style={styles.gradientBg}>
          
          {phase === 'bluffing' && (
            <ScrollView contentContainerStyle={styles.contentContainer}>
              <View style={styles.cardGlass}>
                <Text style={styles.phaseLabel}>FASE 1: INSERISCI LA TUA RISPOSTA</Text>
                <Text style={styles.promptText}>{prompt.text}</Text>
              </View>

              {hasSubmittedBluff ? (
                <View style={styles.waitingBox}>
                  <Ionicons name="checkmark-circle" size={48} color="#00E5FF" />
                  <Text style={styles.waitingText}>RISPOSTA INVIATA CON SUCCESSO</Text>
                  <Text style={styles.subWaitingText}>In attesa degli altri agenti...</Text>
                </View>
              ) : (
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Scrivi la tua risposta (o bluff)..."
                    placeholderTextColor="#8892B0"
                    value={myBluff}
                    onChangeText={setMyBluff}
                    maxLength={100}
                  />
                  <TouchableOpacity style={styles.submitButton} onPress={handleSubmitBluff}>
                    <LinearGradient colors={['#00E5FF', '#20C997']} style={styles.gradientBtn}>
                      <Text style={styles.submitButtonText}>INVIA RISPOSTA</Text>
                      <Ionicons name="send" size={18} color="#050B14" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.playersStatusSection}>
                <Text style={styles.sectionTitle}>STATO AGENTI NELLA STANZA</Text>
                {players.map((p) => {
                  const hasDone = gameState.submissions?.[p.user_id];
                  return (
                    <View key={p.id} style={styles.playerStatusRow}>
                      <Text style={styles.playerName}>{p.nickname}</Text>
                      <View style={[styles.statusIndicator, hasDone ? styles.statusReady : styles.statusWaiting]} />
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {phase === 'voting' && (
            <ScrollView contentContainerStyle={styles.contentContainer}>
              <View style={styles.cardGlass}>
                <Text style={styles.phaseLabel}>FASE 2: INDOVINA LA VERITÀ</Text>
                <Text style={styles.promptText}>{prompt.text}</Text>
              </View>

              {isSuspense ? (
                <View style={styles.waitingBox}>
                  <Ionicons name="flash" size={48} color="#00E5FF" />
                  <Text style={styles.waitingText}>ANALISI VOTI E BLUFF...</Text>
                  <Text style={styles.subWaitingText}>Preparazione rivelazione verità...</Text>
                </View>
              ) : hasVoted ? (
                <View style={styles.waitingBox}>
                  <Ionicons name="time" size={48} color="#00E5FF" />
                  <Text style={styles.waitingText}>VOTO REGISTRATO</Text>
                  <Text style={styles.subWaitingText}>In attesa degli altri agenti...</Text>
                </View>
              ) : (
                <View style={styles.choicesList}>
                  <Text style={styles.instructionText}>Qual è la risposta vera o il bluff migliore?</Text>
                  {(gameState.choices || []).map((choice: any, index: number) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.choiceCard}
                      onPress={() => handleVote(choice.id)}
                    >
                      <BlurView intensity={70} tint="dark" style={styles.choiceBlur}>
                        <Text style={styles.choiceText}>{choice.text}</Text>
                        <Ionicons name="chevron-forward" size={18} color="#00E5FF" />
                      </BlurView>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          )}

          {phase === 'scoring' && (
            <ScrollView contentContainerStyle={styles.contentContainer}>
              <View style={styles.cardGlass}>
                <Text style={styles.phaseLabel}>CLASSIFICA E RIVELAZIONE</Text>
                <Text style={styles.promptText}>La risposta corretta era: {prompt.truth}</Text>
              </View>

              <Animated.View style={[styles.scoreboard, { transform: [{ scale: scoreScale }] }]}>
                <Text style={styles.sectionTitle}>PUNTEGGI ATTUALI (ROUND {currentRound} / 10)</Text>
                {sortedPlayers.map((p, idx) => (
                  <View key={p.id} style={styles.scoreRow}>
                    <Text style={styles.scoreRank}>#{idx + 1}</Text>
                    <Text style={styles.scoreName}>{p.nickname}</Text>
                    <Text style={styles.scorePoints}>{p.score || 0} PT</Text>
                  </View>
                ))}
              </Animated.View>

              <TouchableOpacity style={styles.nextRoundButton} onPress={handleNextRound}>
                <LinearGradient colors={isFinalRound ? ['#FFD700', '#FF8C00'] : ['#00E5FF', '#20C997']} style={styles.gradientBtn}>
                  <Text style={[styles.submitButtonText, isFinalRound && { color: '#050B14' }]}>
                    {isFinalRound ? 'MOSTRA CLASSIFICA FINALE / PODIO' : 'PROSSIMO ROUND'}
                  </Text>
                  <Ionicons name={isFinalRound ? 'trophy' : 'arrow-forward'} size={18} color={isFinalRound ? '#050B14' : '#050B14'} />
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          )}

        </LinearGradient>
      </Animated.View>

      {/* PODIUM / ENDGAME MODAL */}
      <Modal visible={isPodiumModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.podiumModalContent}>
            <Ionicons name="trophy" size={48} color="#FFD700" style={{ marginBottom: 10 }} />
            <Text style={styles.podiumModalTitle}>PODIO FINALE - NAUGHTY PACK COMPLETATO</Text>

            <ScrollView contentContainerStyle={{ paddingVertical: 10, width: '100%' }}>
              {sortedPlayers.map((p, idx) => (
                <View key={p.id} style={[styles.podiumRow, idx === 0 && styles.podiumFirst]}>
                  <Text style={[styles.podiumRank, idx === 0 && { color: '#FFD700' }]}>#{idx + 1}</Text>
                  <Text style={styles.podiumName}>{p.nickname}</Text>
                  <Text style={styles.podiumScore}>{p.score || 0} PT</Text>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.exitPartyBtn} onPress={() => { setIsPodiumModalVisible(false); navigation.replace('Main'); }}>
              <LinearGradient colors={['#00E5FF', '#20C997']} style={styles.gradientBtn}>
                <Text style={[styles.submitButtonText, { color: '#050B14' }]}>TORNA ALLA SCHERMATA PRINCIPALE</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PAUSE MODAL */}
      <Modal visible={isPaused} transparent animationType="fade">
        <BlurView intensity={95} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>PROTOCOLLO IN PAUSA</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setIsPaused(false)}>
              <Text style={styles.modalButtonText}>RIPRENDI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.modalButtonDanger]} onPress={handleLeaveGame}>
              <Text style={[styles.modalButtonText, { color: '#FF0055' }]}>ABBANDONA PROTOCOLLO</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050B14' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#050B14' },
  loadingText: { color: '#00E5FF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#233554',
    zIndex: 10,
  },
  pauseButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#00E5FF', fontSize: 13, fontWeight: 'bold', letterSpacing: 1.5 },
  timerBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121624', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#233554' },
  timerText: { color: '#FF0055', marginLeft: 6, fontWeight: 'bold', fontSize: 14 },
  container: { flex: 1 },
  gradientBg: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  cardGlass: {
    backgroundColor: '#121624',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#233554',
    padding: 20,
    marginBottom: 20,
  },
  phaseLabel: { color: '#00E5FF', fontSize: 12, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 },
  promptText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', lineHeight: 26 },
  inputContainer: { marginTop: 10 },
  textInput: {
    backgroundColor: '#050B14',
    borderWidth: 1,
    borderColor: '#233554',
    borderRadius: 12,
    color: '#FFF',
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  submitButton: { borderRadius: 12, overflow: 'hidden' },
  gradientBtn: { paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  submitButtonText: { color: '#050B14', fontSize: 15, fontWeight: '900', marginRight: 8, letterSpacing: 1 },
  waitingBox: { alignItems: 'center', justifyContent: 'center', padding: 40, backgroundColor: '#121624', borderRadius: 16, borderWidth: 1, borderColor: '#233554' },
  waitingText: { color: '#00E5FF', fontSize: 16, fontWeight: 'bold', marginTop: 12, letterSpacing: 1 },
  subWaitingText: { color: '#8892B0', fontSize: 14, marginTop: 4 },
  playersStatusSection: { marginTop: 30 },
  sectionTitle: { color: '#8892B0', fontSize: 12, fontWeight: 'bold', marginBottom: 12, letterSpacing: 1 },
  playerStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#121624', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#233554' },
  playerName: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  statusIndicator: { width: 12, height: 12, borderRadius: 6 },
  statusReady: { backgroundColor: '#00E5FF' },
  statusWaiting: { backgroundColor: '#8892B0' },
  instructionText: { color: '#8892B0', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  choicesList: { marginTop: 10 },
  choiceCard: { marginBottom: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#233554' },
  choiceBlur: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#121624' },
  choiceText: { color: '#FFF', fontSize: 16, flex: 1, marginRight: 10 },
  scoreboard: { marginTop: 10, marginBottom: 30 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#121624', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#233554' },
  scoreRank: { color: '#00E5FF', fontSize: 16, fontWeight: 'bold', width: 40 },
  scoreName: { color: '#FFF', fontSize: 16, flex: 1 },
  scorePoints: { color: '#FF0055', fontSize: 16, fontWeight: 'bold' },
  nextRoundButton: { borderRadius: 12, overflow: 'hidden', marginTop: 20 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(5, 11, 20, 0.85)' },
  modalContent: { width: '80%', backgroundColor: '#121624', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#233554', alignItems: 'center' },
  modalTitle: { color: '#00E5FF', fontSize: 18, fontWeight: 'bold', marginBottom: 20, letterSpacing: 1 },
  modalButton: { width: '100%', backgroundColor: '#050B14', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#233554' },
  modalButtonDanger: { borderColor: '#FF0055' },
  modalButtonText: { color: '#00E5FF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  podiumModalContent: { width: '90%', maxHeight: '80%', backgroundColor: '#121624', borderRadius: 24, padding: 24, borderWidth: 2, borderColor: '#FFD700', alignItems: 'center' },
  podiumModalTitle: { color: '#FFD700', fontSize: 16, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center', marginBottom: 16 },
  podiumRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#050B14', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#233554', width: '100%' },
  podiumFirst: { borderColor: '#FFD700', backgroundColor: 'rgba(255, 215, 0, 0.1)' },
  podiumRank: { color: '#00E5FF', fontSize: 18, fontWeight: 'bold', width: 45 },
  podiumName: { color: '#FFF', fontSize: 16, fontWeight: 'bold', flex: 1 },
  podiumScore: { color: '#FFD700', fontSize: 16, fontWeight: '900' },
  exitPartyBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 20, width: '100%' }
});
