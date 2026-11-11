import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar, TouchableOpacity, Animated, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import * as Haptics from 'expo-haptics';
import * as ScreenOrientation from 'expo-screen-orientation';
import { supabase } from '../lib/supabase';
import { handleGameScoreSubmission } from '../lib/gameUtils';

const htmlGameContent = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        body, html { 
            margin: 0; padding: 0; 
            background: transparent;
            overflow: hidden; touch-action: none; 
        }
        #game-container { width: 100vw; height: 100vh; display: block; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
</head>
<body>
    <div id="game-container"></div>
    <script>
        let scene, camera, renderer;
        let objectsGroup;
        let particles = [];
        
        let state = 'IDLE'; 
        let timer = 0;

        function init() {
            scene = new THREE.Scene();
            
            // Telecamera allontanata per inquadrare tutta la gabbia
            camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
            camera.position.set(0, 0, 18);

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.getElementById('game-container').appendChild(renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambientLight);
            
            const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
            dirLight.position.set(5, 10, 10);
            scene.add(dirLight);

            // Gabbia adattata allo schermo dello smartphone (più alta che larga)
            const boxGeo = new THREE.BoxGeometry(10, 15, 6);
            const boxEdges = new THREE.EdgesGeometry(boxGeo);
            const boxLine = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: 0x00E5FF, transparent: true, opacity: 0.15 }));
            scene.add(boxLine);

            objectsGroup = new THREE.Group();
            scene.add(objectsGroup);

            window.addEventListener('resize', onWindowResize);
            document.addEventListener('message', handleMessage);
            window.addEventListener('message', handleMessage);

            animate();
            
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'READY' }));
            }
        }

        function handleMessage(event) {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'SPAWN') {
                    spawnObjects(msg.count);
                } else if (msg.type === 'SUCCESS') {
                    flashColor(0x39FF14);
                } else if (msg.type === 'FAIL') {
                    flashColor(0xFF0055);
                }
            } catch(e) {}
        }

        function spawnObjects(count) {
            particles.forEach(p => objectsGroup.remove(p.mesh));
            particles = [];

            const geo = new THREE.IcosahedronGeometry(0.6, 0);
            const mat = new THREE.MeshStandardMaterial({ 
                color: 0x00E5FF, 
                emissive: 0x0077AA, 
                roughness: 0.2, 
                metalness: 0.8 
            });

            for (let i = 0; i < count; i++) {
                const mesh = new THREE.Mesh(geo, mat);
                
                // FIX: Coordinate di spawn ridotte. 
                // X (Larghezza) passa da 8.5 a 6.0
                // Y (Altezza) passa da 13.5 a 10.0
                // Z (Profondità) passa da 4 a 3.0 per evitare che si avvicinino troppo alla camera
                mesh.position.set(
                    (Math.random() - 0.5) * 6.0,  
                    (Math.random() - 0.5) * 10.0, 
                    (Math.random() - 0.5) * 3.0   
                );
                mesh.scale.set(0, 0, 0);
                
                objectsGroup.add(mesh);
                particles.push({
                    mesh: mesh,
                    // FIX: Ridotta leggermente la dimensione massima dei cristalli (da 1.4 a 1.2)
                    targetScale: 0.8 + Math.random() * 0.4, 
                    rotSpeed: { x: Math.random()*0.1, y: Math.random()*0.1 }
                });
            }

            state = 'SPAWNING';
            timer = 0;
        }

        function flashColor(hexColor) {
            scene.background = new THREE.Color(hexColor);
            setTimeout(() => { scene.background = null; }, 150);
        }

        function animate() {
            requestAnimationFrame(animate);

            objectsGroup.rotation.y += 0.005;
            objectsGroup.rotation.x += 0.002;

            if (state === 'SPAWNING') {
                let allGrown = true;
                particles.forEach(p => {
                    p.mesh.scale.lerp(new THREE.Vector3(p.targetScale, p.targetScale, p.targetScale), 0.2);
                    p.mesh.rotation.x += p.rotSpeed.x;
                    p.mesh.rotation.y += p.rotSpeed.y;
                    if (Math.abs(p.mesh.scale.x - p.targetScale) > 0.05) allGrown = false;
                });
                if (allGrown) { state = 'WAITING'; timer = 0; }
            } 
            else if (state === 'WAITING') {
                particles.forEach(p => {
                    p.mesh.rotation.x += p.rotSpeed.x;
                    p.mesh.rotation.y += p.rotSpeed.y;
                });
                timer++;
                if (timer > 40) state = 'HIDING';
            }
            else if (state === 'HIDING') {
                let allShrunk = true;
                particles.forEach(p => {
                    p.mesh.scale.lerp(new THREE.Vector3(0, 0, 0), 0.2);
                    p.mesh.rotation.x += p.rotSpeed.x;
                    p.mesh.rotation.y += p.rotSpeed.y;
                    if (p.mesh.scale.x > 0.05) allShrunk = false;
                });
                if (allShrunk) {
                    state = 'IDLE';
                    if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'HIDDEN' }));
                    }
                }
            }

            renderer.render(scene, camera);
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        init();
    </script>
</body>
</html>
`;

export default function VisualCounterScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const webViewRef = useRef<any>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [practiceUsed, setPracticeUsed] = useState(false);
  const [isTrainingMode, setIsTrainingMode] = useState(false);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [showDots, setShowDots] = useState(true);
  const [currentInput, setCurrentInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(3);
  const [activeMultiplier, setActiveMultiplier] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  const correctCountRef = useRef(0);
  const isPlayingRef = useRef(false);
  const phaseRef = useRef<'SHOWING' | 'INPUT'>('SHOWING');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      isPlayingRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startGame = () => {
    setIsPlaying(true);
    setGameOver(false);
    isPlayingRef.current = true;
    setScore(0);
    setRound(1);
  };

  const restartGame = () => {
    setGameOver(false);
    isPlayingRef.current = true;
    setScore(0);
    setRound(1);
    startRound(1);
  };

  const startRound = (currentRound: number) => {
    if (!isPlayingRef.current) return;
    setCurrentInput('');
    phaseRef.current = 'SHOWING';
    setShowDots(true);

    const count = Math.min(25, 2 + Math.floor(currentRound * 0.8) + Math.floor(Math.random() * 3));
    correctCountRef.current = count;

    if (webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({ type: 'SPAWN', count }));
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
        const msg = JSON.parse(event.nativeEvent.data);
        if (msg.type === 'READY') {
            startRound(1);
        } 
        else if (msg.type === 'HIDDEN') {
            if (!isPlayingRef.current) return;
            setShowDots(false);
            phaseRef.current = 'INPUT';
            startInputTimer();
        }
    } catch(err) {}
  };

  const startInputTimer = () => {
    setTimeLeft(3);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (isPlayingRef.current) {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            triggerGameOver();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
  };

  const handleKeyPress = (val: string) => {
    if (!isPlayingRef.current || phaseRef.current !== 'INPUT') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (val === 'DEL') {
      setCurrentInput(prev => prev.slice(0, -1));
      return;
    }
    if (val === 'ENTER') {
      submitAnswer();
      return;
    }

    const nextInput = currentInput + val;
    setCurrentInput(nextInput);

    if (nextInput.length >= correctCountRef.current.toString().length) {
      setTimeout(() => { checkAnswer(nextInput); }, 50);
    }
  };

  const submitAnswer = () => checkAnswer(currentInput);

  const checkAnswer = (inputStr: string) => {
    if (!isPlayingRef.current || phaseRef.current !== 'INPUT') return;
    if (timerRef.current) clearInterval(timerRef.current);

    const userAns = parseInt(inputStr, 10);
    if (userAns === correctCountRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (webViewRef.current) webViewRef.current.postMessage(JSON.stringify({ type: 'SUCCESS' }));

      setScore(prev => prev + (round * 20));
      setRound(prev => prev + 1);
      
      setTimeout(() => {
        if (isPlayingRef.current) startRound(round + 1);
      }, 600); 
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (webViewRef.current) webViewRef.current.postMessage(JSON.stringify({ type: 'FAIL' }));
      setTimeout(() => { triggerGameOver(); }, 300);
    }
  };

  const triggerGameOver = async () => {
    isPlayingRef.current = false;
    if (timerRef.current) clearInterval(timerRef.current);
    setGameOver(true);

    let computedFinalScore = score;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('current_game_multiplier').eq('id', user.id).single();
      const multi = profile?.current_game_multiplier || 0;
      setActiveMultiplier(multi);

      if (multi > 0) {
        computedFinalScore = Math.floor(score * (1 + (multi / 100)));
      }
      setFinalScore(computedFinalScore);

      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase.from('arcade_scores')
        .select('*').eq('user_id', user.id).eq('play_date', today).eq('game_id', 'VisualCounter').single();
      
      if (existing) {
        if (computedFinalScore > existing.score) {
          await supabase.from('arcade_scores').update({ score: computedFinalScore }).eq('id', existing.id);
        }
      } else {
        await supabase.from('arcade_scores').insert({ user_id: user.id, play_date: today, game_id: 'VisualCounter', score: computedFinalScore });
      }
    } else {
      setFinalScore(score);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar hidden={true} />

      <BlurView intensity={40} tint="dark" style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#00E5FF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>VISUAL COUNTER 3D</Text>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreText}>{score} PTS</Text>
        </View>
      </BlurView>

      <View style={styles.container}>
        {!isPlaying ? (
          <View style={styles.tutorialContainer}>
            <LinearGradient colors={['#050B14', '#112240']} style={styles.tutorialCard}>
              <Ionicons name="eye" size={54} color="#00E5FF" style={{ marginBottom: 16 }} />
              <Text style={styles.tutorialTitle}>MISSION BRIEFING // VISUAL COUNTER</Text>
              <Text style={styles.tutorialText}>
                I cristalli olografici si formeranno all'interno della gabbia per pochi istanti.
                {"\n\n"}Memorizza a colpo d'occhio l'esatta quantità. Appena scompariranno, avrai solo <Text style={{fontWeight: '900', color: '#FF0055'}}>3 secondi</Text> per inserire il numero corretto.
                {"\n\n"}Un solo errore causerà il collasso immediato del sistema.
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
          <View style={styles.gameArea}>
            <View style={styles.statusRow}>
               <Text style={[styles.timerText, timeLeft <= 1 && { color: '#FF0055' }]}>
                 {showDots ? 'ANALISI IN CORSO...' : `00:0${timeLeft}`}
               </Text>
            </View>

            <View style={styles.displayBox} pointerEvents="none">
              <WebView
                  ref={webViewRef}
                  source={{ html: htmlGameContent }}
                  style={{ flex: 1, backgroundColor: 'transparent' }}
                  onMessage={handleWebViewMessage}
                  scrollEnabled={false}
                  javaScriptEnabled={true}
              />
              {!showDots && (
                <View style={styles.overlayPrompt}>
                  <Text style={styles.promptText}>QUANTI CRISTALLI?</Text>
                </View>
              )}
            </View>

            {!showDots && (
              <View style={styles.inputContainer}>
                <View style={styles.screenBox}>
                  <Text style={styles.inputText}>{currentInput || '_'}</Text>
                </View>

                <View style={styles.keypad}>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'ENTER'].map((btn, idx) => (
                    <Pressable
                      key={idx}
                      style={({ pressed }) => [
                        styles.keyBtnWrapper,
                        pressed && { transform: [{ translateY: 4 }] }
                      ]}
                      onPress={() => handleKeyPress(btn)}
                    >
                      <View style={[
                        styles.keyBtnBase,
                        { backgroundColor: btn === 'ENTER' ? '#2bc80f' : btn === 'DEL' ? '#cc0044' : '#0B132B' }
                      ]} />
                      <LinearGradient
                        colors={
                          btn === 'ENTER' ? ['#39FF14', '#2bc80f'] :
                          btn === 'DEL' ? ['#FF0055', '#cc0044'] :
                          ['#1E293B', '#0F172A']
                        }
                        style={styles.keyBtnTop}
                      >
                        <Text style={[styles.keyText, (btn === 'ENTER' || btn === 'DEL') && { color: '#05070A' }]}>
                          {btn}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {gameOver && (
          <View style={styles.gameOverOverlayFull}>
            <Text style={styles.gameOverTitle}>CRASH DI SISTEMA</Text>
            
            {/* Mostra il numero esatto per capire l'errore */}
            <Text style={styles.gameOverCount}>I cristalli erano: {correctCountRef.current}</Text>
            
            <Text style={styles.gameOverScore}>
              Punteggio finale: {finalScore} 
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
{activeMultiplier > 0 && <Text style={{ textDecorationLine: 'line-through', color: '#8892B0', fontSize: 16 }}>({score})</Text>}
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
  
  gameArea: { flex: 1, justifyContent: 'center', paddingTop: 60, paddingBottom: 10 },
  statusRow: { alignItems: 'center', marginBottom: 10 },
  timerText: { color: '#00E5FF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  
  displayBox: { flex: 1, width: '96%', alignSelf: 'center', backgroundColor: 'rgba(10, 25, 47, 0.6)', borderRadius: 18, borderWidth: 1, borderColor: '#00E5FF', position: 'relative', overflow: 'hidden', shadowColor: '#00E5FF', shadowOpacity: 0.2, shadowRadius: 12, marginBottom: 10 },
  overlayPrompt: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  promptText: { color: '#00E5FF', fontSize: 22, fontWeight: '900', letterSpacing: 1.5, textShadowColor: '#00E5FF', textShadowRadius: 10 },

  inputContainer: { backgroundColor: 'rgba(17, 34, 64, 0.95)', padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(0, 229, 255, 0.2)', alignItems: 'center', borderRadius: 18, marginHorizontal: 8 },
  screenBox: { width: '100%', height: 46, backgroundColor: '#050B14', borderRadius: 12, borderWidth: 1, borderColor: '#00E5FF', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#00E5FF', shadowOpacity: 0.3, shadowRadius: 8 },
  inputText: { color: '#00E5FF', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  
  keypad: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  keyBtnWrapper: { width: '30%', height: 48, position: 'relative' },
  keyBtnBase: { position: 'absolute', top: 4, left: 0, right: 0, bottom: 0, borderRadius: 10 },
  keyBtnTop: { flex: 1, width: '100%', height: '100%', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, elevation: 3 },
  keyText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  gameOverOverlayFull: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 11, 20, 0.95)', justifyContent: 'center', alignItems: 'center', zIndex: 200, padding: 24,  },
  gameOverTitle: { fontSize: 34, color: '#FF0055', fontWeight: '900', marginBottom: 10, textShadowColor: '#FF0055', textShadowRadius: 15 },
  gameOverCount: { fontSize: 18, color: '#00E5FF', marginBottom: 15, fontWeight: 'bold', letterSpacing: 1 },
  gameOverScore: { fontSize: 20, color: '#FFF', marginBottom: 40, fontWeight: 'bold' },
  goBtnRow: { flexDirection: 'row', gap: 16, width: '100%', maxWidth: 400 },
  goRestartBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#00E5FF', paddingVertical: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: '#00E5FF', shadowRadius: 15, shadowOpacity: 0.4 },
  goRestartBtnText: { color: '#050B14', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  goExitBtn: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(255, 0, 85, 0.2)', borderWidth: 1, borderColor: '#FF0055', paddingVertical: 16, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  goExitBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15, letterSpacing: 1 },
  statusBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 229, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#00E5FF', marginBottom: 16 },
  statusBoxTraining: { backgroundColor: 'rgba(255, 215, 0, 0.1)', borderColor: '#FFD700' },
  statusBoxWarning: { backgroundColor: 'rgba(255, 136, 0, 0.1)', borderColor: '#FF8800' },
  statusBoxDanger: { backgroundColor: 'rgba(255, 0, 85, 0.1)', borderColor: '#FF0055' },
  statusText: { color: '#00E5FF', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});