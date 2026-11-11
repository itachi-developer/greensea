import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, StatusBar, Alert, Animated, Modal, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { handleGameScoreSubmission } from '../lib/gameUtils';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';

// Aggiunti 2 nuovi colori: Viola e Arancione
const COLORS = [
  { name: 'ROSSO', code: '#FF0055', gradient: ['#FF0055', '#cc0044'], shadow: '#FF0055' },
  { name: 'VERDE', code: '#39FF14', gradient: ['#39FF14', '#2bc80f'], shadow: '#39FF14' },
  { name: 'BLU', code: '#00F0FF', gradient: ['#00F0FF', '#00bcd4'], shadow: '#00F0FF' },
  { name: 'GIALLO', code: '#FFD700', gradient: ['#FFD700', '#cca600'], shadow: '#FFD700' },
  { name: 'VIOLA', code: '#B026FF', gradient: ['#B026FF', '#8a1cba'], shadow: '#B026FF' },
  { name: 'ARANCIO', code: '#FF8C00', gradient: ['#FF8C00', '#cc7000'], shadow: '#FF8C00' },
];

export default function StroopTestScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [word, setWord] = useState({ text: 'ROSSO', colorCode: '#39FF14' });
  const [correctColorCode, setCorrectColorCode] = useState('#39FF14');
  
  // Stati di gioco
  const [currentMaxTime, setCurrentMaxTime] = useState(2.5);
  const [timeLeft, setTimeLeft] = useState(2.5);

  const [activeMultiplier, setActiveMultiplier] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [practiceUsed, setPracticeUsed] = useState(false);
  const [isTrainingMode, setIsTrainingMode] = useState(false);

  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scoreScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    return () => {
      isPlayingRef.current = false;
      isPausedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      progressAnim.stopAnimation();
      shakeAnim.stopAnimation();
      scoreScale.stopAnimation();
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const triggerScreenShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 15, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -15, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const triggerScorePop = () => {
    scoreScale.setValue(1.3);
    Animated.spring(scoreScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const startGame = () => {
    setIsPlaying(true);
    setGameOver(false);
    isPlayingRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;
    setScore(0);
    setCurrentMaxTime(2.5); // Partenza morbida
    nextRound(2.5);
  };

  const restartGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    progressAnim.stopAnimation();
    startGame();
  };

  const nextRound = (maxTime: number) => {
    if (!isPlayingRef.current || isPausedRef.current) return;

    // Logica Stroop migliorata con 6 colori
    const textObj = COLORS[Math.floor(Math.random() * COLORS.length)];
    let colorObj = COLORS[Math.floor(Math.random() * COLORS.length)];
    
    // Alta probabilità di incongruenza per forzare l'errore semantico
    if (Math.random() < 0.75 && textObj.code === colorObj.code) {
      const otherColors = COLORS.filter(c => c.code !== textObj.code);
      colorObj = otherColors[Math.floor(Math.random() * otherColors.length)];
    }

    setWord({ text: textObj.name, colorCode: colorObj.code });
    setCorrectColorCode(colorObj.code);

    setTimeLeft(maxTime);
    progressAnim.setValue(1);
    
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: maxTime * 1000,
      useNativeDriver: false, // Serve false per interpolare la width
    }).start();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!isPausedRef.current && isPlayingRef.current) {
        setTimeLeft(prev => {
          if (prev <= 0.1) {
            if (timerRef.current) clearInterval(timerRef.current);
            triggerScreenShake();
            handleGameOver();
            return 0;
          }
          return Number((prev - 0.1).toFixed(1));
        });
      }
    }, 100);
  };

  const handleButtonPress = (colorCode: string) => {
    if (!isPlayingRef.current || isPausedRef.current) return;

    if (timerRef.current) clearInterval(timerRef.current);
    progressAnim.stopAnimation();

    if (colorCode === correctColorCode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      let nextMaxTime = currentMaxTime;
      setScore(prev => {
        const nextScore = prev + 20;
        triggerScorePop();
        
        // Riduzione progressiva del tempo in base al punteggio
        if (nextScore > 600) nextMaxTime = 0.7; // Difficoltà massima
        else if (nextScore > 400) nextMaxTime = 0.9;
        else if (nextScore > 200) nextMaxTime = 1.2;
        else if (nextScore > 100) nextMaxTime = 1.6;
        else if (nextScore > 40) nextMaxTime = 2.0;

        setCurrentMaxTime(nextMaxTime);
        return nextScore;
      });
      
      // Ritardo millimetrico per permettere l'aggiornamento dello stato
      setTimeout(() => {
        nextRound(nextMaxTime);
      }, 0);

    } else {
      triggerScreenShake();
      handleGameOver();
    }
  };

  const togglePause = () => {
    if (!isPlaying || gameOver) return;
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    isPausedRef.current = nextPaused;
    
    // Gestione dell'animazione della barra timer durante la pausa
    if (nextPaused) {
      progressAnim.stopAnimation();
    } else {
      // Riprende l'animazione calcolando il tempo rimanente
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: timeLeft * 1000,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleGameOver = async () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    isPausedRef.current = false;
    setGameOver(true);
    if (timerRef.current) clearInterval(timerRef.current);
    progressAnim.stopAnimation();

    const res = await handleGameScoreSubmission({
      gameId: 'StroopTest',
      rawScore: score,
      routeParams: route.params,
    });

    setActiveMultiplier(res.activeMultiplier);
    setFinalScore(res.computedFinalScore);
    setStatusMessage(res.statusMessage);
    setAttemptsUsed(res.attemptsUsed);
    setPracticeUsed(res.practiceUsed);
    setIsTrainingMode(res.isTrainingMode);
  };

  const barWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const barColor = progressAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ['#FF0055', '#FFD700', '#00E5FF']
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden={true} />

      {/* Header coerente con Visual Counter */}
      <BlurView intensity={40} tint="dark" style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#00E5FF" />
        </TouchableOpacity>
        
        {isPlaying && !gameOver && (
          <TouchableOpacity onPress={togglePause} style={{ paddingHorizontal: 10 }}>
            <Ionicons name={isPaused ? "play" : "pause"} size={22} color="#00E5FF" />
          </TouchableOpacity>
        )}

        <Text style={styles.headerTitle}>STROOP NEURAL TEST</Text>
        
        <View style={styles.scoreBox}>
          <Animated.Text style={[styles.scoreText, { transform: [{ scale: scoreScale }] }]}>
            {score} PTS
          </Animated.Text>
        </View>
      </BlurView>

      <View style={styles.container}>
        {!isPlaying && !gameOver ? (
          <View style={styles.tutorialContainer}>
            <LinearGradient colors={['#050B14', '#112240']} style={styles.tutorialCard}>
              <Ionicons name="color-palette" size={54} color="#00E5FF" style={{ marginBottom: 16 }} />
              <Text style={styles.tutorialTitle}>MISSION BRIEFING // STROOP</Text>
              <Text style={styles.tutorialText}>
                Ignora il significato semantico della parola.
                {"\n\n"}Devi premere il bottone corrispondente al <Text style={{fontWeight: '900', color: '#FF0055'}}>COLORE DEL TESTO</Text>, non alla parola scritta.
                {"\n\n"}Il tempo a disposizione diminuirà drasticamente man mano che accumulerai punti neurali. Un errore causa il crash.
              </Text>
              
              <View style={styles.tutorialBtnRow}>
                <TouchableOpacity style={[styles.tutBtn, { backgroundColor: 'rgba(0,0,0,0.3)' }]} onPress={() => navigation.goBack()}>
                  <Ionicons name="arrow-back" size={18} color="#FFF" style={{ marginRight: 6 }} />
                  <Text style={styles.tutBtnText}>INDIETRO</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.tutBtn, { backgroundColor: '#00E5FF' }]} onPress={startGame}>
                  <Ionicons name="play" size={18} color="#050B14" style={{ marginRight: 6 }} />
                  <Text style={[styles.tutBtnText, { color: '#050B14' }]}>AVVIA TEST</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        ) : (
          <Animated.View style={[styles.gameArea, { transform: [{ translateX: shakeAnim }] }]}>
            <View style={styles.timerBarContainer} pointerEvents="none">
              <Animated.View style={[styles.timerBarFill, { width: barWidth, backgroundColor: barColor }]} />
            </View>

            <View style={styles.wordContainer} pointerEvents="none">
              <Text style={[styles.stroopWord, { 
                color: word.colorCode,
                textShadowColor: word.colorCode,
                textShadowOffset: { width: 0, height: 4 },
                textShadowRadius: 18
              }]}>
                {word.text}
              </Text>
              <Text style={styles.instructionPrompt}>SELEZIONA IL COLORE DELL'INCHIOSTRO</Text>
            </View>

            <View style={styles.buttonsGrid}>
              {COLORS.map(c => (
                <Pressable
                  key={c.code}
                  style={({ pressed }) => [
                    styles.colorBtnWrapper,
                    pressed && { transform: [{ translateY: 4 }] }
                  ]}
                  onPress={() => handleButtonPress(c.code)}
                >
                  <View style={[styles.colorBtnBase, { backgroundColor: c.shadow }]} />
                  <LinearGradient
                    colors={c.gradient as any}
                    style={styles.colorBtnTop}
                  >
                    <Text style={styles.colorBtnText}>{c.name}</Text>
                  </LinearGradient>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {gameOver && (
          <View style={styles.gameOverOverlayFull}>
            <Text style={styles.gameOverTitle}>CRASH DI SISTEMA</Text>
            <Text style={styles.gameOverCount}>Test neurale fallito.</Text>
            
            {statusMessage ? (
              <View style={[
                styles.statusBox,
                isTrainingMode && styles.statusBoxTraining,
                statusMessage.includes('SCADENTE') && styles.statusBoxWarning,
                statusMessage.includes('ESAURITI') && styles.statusBoxDanger
              ]}>
                <Ionicons 
                  name={
                    isTrainingMode ? "school-outline" : 
                    statusMessage.includes('SCADENTE') ? "alert-circle-outline" :
                    statusMessage.includes('ESAURITI') ? "lock-closed-outline" : "checkmark-circle-outline"
                  } 
                  size={18} 
                  color={
                    isTrainingMode ? "#FFD700" :
                    statusMessage.includes('SCADENTE') ? "#FF8800" :
                    statusMessage.includes('ESAURITI') ? "#FF0055" : "#00E5FF"
                  } 
                  style={{ marginRight: 6 }}
                />
                <Text style={[
                  styles.statusText,
                  isTrainingMode && { color: '#FFD700' },
                  statusMessage.includes('SCADENTE') && { color: '#FF8800' },
                  statusMessage.includes('ESAURITI') && { color: '#FF0055' }
                ]}>
                  {statusMessage}
                </Text>
              </View>
            ) : null}

            <Text style={styles.gameOverScore}>
              Punteggio finale: {finalScore} {activeMultiplier > 0 && <Text style={{ textDecorationLine: 'line-through', color: '#8892B0', fontSize: 16 }}>({score})</Text>}
            </Text>
            {activeMultiplier > 0 && (
              <Text style={{ color: '#39FF14', fontSize: 14, fontWeight: '900', marginBottom: 20, letterSpacing: 1, textShadowColor: '#39FF14', textShadowRadius: 10 }}>
                +{activeMultiplier}% BONUS TURBINA APPLICATO!
              </Text>
            )}
            
            <View style={styles.goBtnRow}>
              <TouchableOpacity style={styles.goRestartBtn} onPress={restartGame}>
                <Ionicons name="refresh" size={20} color="#050B14" style={{ marginRight: 8 }} />
                <Text style={styles.goRestartBtnText}>RIAVVIA</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.goExitBtn} onPress={() => navigation.goBack()}>
                <Ionicons name="exit-outline" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.goExitBtnText}>ESCI</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Pause Overlay */}
      <Modal visible={isPaused} transparent animationType="fade">
        <BlurView intensity={95} tint="dark" style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>SISTEMA IN PAUSA</Text>
            <TouchableOpacity style={styles.modalBtnResume} onPress={togglePause}>
              <Text style={styles.modalBtnTextResume}>RIPRENDI</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalBtnQuit} onPress={() => { setIsPaused(false); setGameOver(true); }}>
              <Text style={styles.modalBtnTextQuit}>RITIRATI E SALVA</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#050B14' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 100, borderBottomWidth: 1, borderColor: 'rgba(0, 229, 255, 0.2)' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { color: '#FFF', fontWeight: '900', fontSize: 14, letterSpacing: 2 },
  scoreBox: { backgroundColor: 'rgba(0, 229, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.4)' },
  scoreText: { color: '#00E5FF', fontWeight: '900', fontSize: 13 },
  container: { flex: 1, position: 'relative' },
  
  tutorialContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#050B14', paddingTop: 50 },
  tutorialCard: { width: '100%', maxWidth: 500, padding: 30, borderRadius: 20, alignItems: 'center', shadowColor: '#00E5FF', shadowRadius: 30, shadowOpacity: 0.3 },
  tutorialTitle: { color: '#00E5FF', fontSize: 18, fontWeight: '900', letterSpacing: 1.5, marginBottom: 16, textAlign: 'center' },
  tutorialText: { color: '#EAF4FF', fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 28 },
  tutorialBtnRow: { flexDirection: 'row', gap: 16, width: '100%' },
  tutBtn: { flex: 1, flexDirection: 'row', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  tutBtnText: { fontWeight: '900', fontSize: 13, letterSpacing: 1, color: '#FFF' },
  
  gameArea: { flex: 1, justifyContent: 'space-between', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  timerBarContainer: { width: '100%', height: 10, backgroundColor: '#112240', borderRadius: 5, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)' },
  timerBarFill: { height: '100%', shadowRadius: 8, shadowOpacity: 0.9, elevation: 6 },

  wordContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stroopWord: { fontSize: 48, fontWeight: '900', letterSpacing: 3, marginBottom: 16, textAlign: 'center' },
  instructionPrompt: { color: '#8892B0', fontSize: 12, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', textAlign: 'center' },

  buttonsGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  colorBtnWrapper: { width: '45%', height: 75, position: 'relative' },
  colorBtnBase: { position: 'absolute', top: 6, left: 0, right: 0, bottom: 0, borderRadius: 16 },
  colorBtnTop: { flex: 1, width: '100%', height: '100%', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
  colorBtnText: { color: '#05070A', fontSize: 14, fontWeight: '900', letterSpacing: 1, textShadowColor: 'rgba(255,255,255,0.3)', textShadowRadius: 4 },

  gameOverOverlayFull: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 11, 20, 0.95)', justifyContent: 'center', alignItems: 'center', zIndex: 200, padding: 24 },
  gameOverTitle: { fontSize: 34, color: '#FF0055', fontWeight: '900', marginBottom: 10, textShadowColor: '#FF0055', textShadowRadius: 15 },
  gameOverCount: { fontSize: 18, color: '#00E5FF', marginBottom: 15, fontWeight: 'bold', letterSpacing: 1 },
  gameOverScore: { fontSize: 20, color: '#FFF', marginBottom: 40, fontWeight: 'bold' },
  goBtnRow: { flexDirection: 'row', gap: 16, width: '100%', maxWidth: 400 },
  goRestartBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#00E5FF', paddingVertical: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#00E5FF', shadowRadius: 15, shadowOpacity: 0.4 },
  goRestartBtnText: { color: '#050B14', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  goExitBtn: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(255, 0, 85, 0.2)', borderWidth: 1, borderColor: '#FF0055', paddingVertical: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  goExitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15, letterSpacing: 1 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 320, backgroundColor: '#112240', borderRadius: 24, padding: 28, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)', alignItems: 'center' },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 1.5, marginBottom: 24 },
  modalBtnResume: { width: '100%', backgroundColor: '#00E5FF', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  modalBtnTextResume: { color: '#0A192F', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  modalBtnQuit: { width: '100%', backgroundColor: 'rgba(255, 85, 85, 0.15)', borderWidth: 1, borderColor: '#FF5555', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  modalBtnTextQuit: { color: '#FF5555', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  statusBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 229, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#00E5FF', marginBottom: 16 },
  statusBoxTraining: { backgroundColor: 'rgba(255, 215, 0, 0.1)', borderColor: '#FFD700' },
  statusBoxWarning: { backgroundColor: 'rgba(255, 136, 0, 0.1)', borderColor: '#FF8800' },
  statusBoxDanger: { backgroundColor: 'rgba(255, 0, 85, 0.1)', borderColor: '#FF0055' },
  statusText: { color: '#00E5FF', fontSize: 11, fontWeight: '900', letterSpacing: 1 }
});