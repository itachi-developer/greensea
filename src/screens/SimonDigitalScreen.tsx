import React, { useState, useEffect } from 'react';
import { Text, View, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as ScreenOrientation from 'expo-screen-orientation';
import ArcadeGameWebView from '../components/ArcadeGameWebView';
import PreGameModal from '../components/PreGameModal';
import { gameStyles } from '../styles/GameStyles';
import { RootStackParamList } from '../navigation/AppNavigator';

const htmlGameContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #050B14;
      overflow: hidden;
      touch-action: none;
      font-family: sans-serif;
    }
    canvas {
      display: block;
      width: 100vw;
      height: 100vh;
    }
  </style>
</head>
<body>
  <canvas id="gameCanvas"></canvas>
  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    let gameState = 'START'; // START, PLAYING_SEQUENCE, PLAYER_TURN, GAMEOVER
    let score = 0;
    let round = 0;

    const pads = [
      { id: 0, color: '#00E5FF', name: 'CIANO', x: 0, y: 0, w: 0, h: 0, activeTimer: 0 },
      { id: 1, color: '#FF0055', name: 'MAGENTA', x: 0, y: 0, w: 0, h: 0, activeTimer: 0 },
      { id: 2, color: '#39FF14', name: 'VERDE', x: 0, y: 0, w: 0, h: 0, activeTimer: 0 },
      { id: 3, color: '#FFD700', name: 'GIALLO', x: 0, y: 0, w: 0, h: 0, activeTimer: 0 }
    ];

    let sequence = [];
    let playerIndex = 0;
    let stepTimer = 0;
    let flashTimer = 0;
    let playbackStep = 0;
    let flashInterval = 45; 
    let pauseInterval = 20; 

    function updatePadLayout() {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2 + 30;
      const size = Math.min(canvas.width, canvas.height) * 0.36;
      const gap = 16;

      pads[0].x = centerX - size - gap / 2; pads[0].y = centerY - size - gap / 2; pads[0].w = size; pads[0].h = size;
      pads[1].x = centerX + gap / 2; pads[1].y = centerY - size - gap / 2; pads[1].w = size; pads[1].h = size;
      pads[2].x = centerX - size - gap / 2; pads[2].y = centerY + gap / 2; pads[2].w = size; pads[2].h = size;
      pads[3].x = centerX + gap / 2; pads[3].y = centerY + gap / 2; pads[3].w = size; pads[3].h = size;
    }
    updatePadLayout();
    window.addEventListener('resize', updatePadLayout);

    function startNewGame() {
      score = 0;
      round = 0;
      sequence = [];
      nextRound();
    }

    function nextRound() {
      round++;
      score = round - 1;
      playerIndex = 0;
      sequence.push(Math.floor(Math.random() * 4));
      
      flashInterval = Math.max(18, 45 - round * 2);
      pauseInterval = Math.max(10, 20 - Math.round(round * 0.8));

      gameState = 'PLAYING_SEQUENCE';
      playbackStep = 0;
      stepTimer = 0;
      flashTimer = 0;
    }

    window.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (gameState === 'START') {
        startNewGame();
        return;
      }

      if (gameState === 'GAMEOVER') {
        startNewGame();
        return;
      }

      if (gameState === 'PLAYER_TURN') {
        for (let i = 0; i < pads.length; i++) {
          let p = pads[i];
          if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
            p.activeTimer = 15;

            if (sequence[playerIndex] === p.id) {
              playerIndex++;
              if (playerIndex >= sequence.length) {
                setTimeout(nextRound, 600);
              }
            } else {
              gameState = 'GAMEOVER';
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(score.toString());
              }
            }
            break;
          }
        }
      }
    });

    let sequenceTimer = 0;
    function update() {
      pads.forEach(p => {
        if (p.activeTimer > 0) p.activeTimer--;
      });

      if (gameState === 'PLAYING_SEQUENCE') {
        sequenceTimer++;
        if (sequenceTimer >= flashInterval + pauseInterval) {
          sequenceTimer = 0;
          playbackStep++;
          if (playbackStep >= sequence.length) {
            gameState = 'PLAYER_TURN';
          } else {
            pads[sequence[playbackStep]].activeTimer = flashInterval;
          }
        } else if (sequenceTimer === 1 && playbackStep === 0) {
          pads[sequence[0]].activeTimer = flashInterval;
        }
      }
    }

    function draw() {
      ctx.fillStyle = '#050B14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#121624';
      ctx.fillRect(0, 0, canvas.width, 100);

      ctx.fillStyle = '#8A93B0';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SIMON DIGITAL // PROTOCOLLO MEMORIA', canvas.width / 2, 30);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ROUND ' + round, canvas.width / 2, 70);

      ctx.fillStyle = '#00E5FF';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(score + ' PTS', canvas.width - 20, 50);

      pads.forEach(p => {
        ctx.save();
        let isActive = p.activeTimer > 0;

        ctx.shadowBlur = isActive ? 40 : 12;
        ctx.shadowColor = p.color;
        ctx.fillStyle = isActive ? '#FFFFFF' : '#121624';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.w, p.h, 20);
        ctx.fill();
        ctx.stroke();

        if (isActive) {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.roundRect(p.x + 12, p.y + 12, p.w - 24, p.h - 24, 14);
          ctx.fill();
        }

        ctx.restore();
      });

      ctx.fillStyle = '#8A93B0';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      let statusMsg = gameState === 'PLAYING_SEQUENCE' ? 'OSSERVA LA SEQUENZA...' : gameState === 'PLAYER_TURN' ? "TOCCA I PAD NELL'ORDINE CORRETTO!" : '';
      ctx.fillText(statusMsg, canvas.width / 2, canvas.height - 50);

      if (gameState === 'START') {
        ctx.fillStyle = 'rgba(5, 11, 20, 0.9)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SIMON DIGITAL', canvas.width / 2, canvas.height / 2 - 40);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '16px sans-serif';
        ctx.fillText('Ripeti la sequenza luminosa dei pad', canvas.width / 2, canvas.height / 2);

        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('TOCCA PER INIZIARE', canvas.width / 2, canvas.height / 2 + 50);
      } else if (gameState === 'GAMEOVER') {
        ctx.fillStyle = 'rgba(5, 11, 20, 0.9)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#FF0055';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 30);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px sans-serif';
        ctx.fillText('Punteggio finale: ' + score, canvas.width / 2, canvas.height / 2 + 10);

        ctx.fillStyle = '#00E5FF';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('Tocca per riprovare', canvas.width / 2, canvas.height / 2 + 60);
      }
    }

    function loop() {
      update();
      draw();
      requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>
`;

export default function SimonDigitalScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'SimonDigital'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SimonDigital'>>();
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  return (
    <SafeAreaView style={gameStyles.safeArea}>
      <StatusBar barStyle="light-content" />

      <BlurView intensity={90} tint="dark" style={gameStyles.header}>
        <TouchableOpacity style={gameStyles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#00FFFF" />
        </TouchableOpacity>
        <Text style={gameStyles.headerTitle}>SIMON DIGITAL // MEMORY SYNC</Text>
        <View style={gameStyles.scoreBox}>
          <Text style={gameStyles.scoreText}>ARCADE</Text>
        </View>
      </BlurView>

      <View style={gameStyles.container}>
        <PreGameModal
          visible={!isPlaying}
          title="MISSION BRIEFING // SIMON DIGITAL"
          description="Osserva e memorizza la sequenza di attivazione dei 4 pad luminosi (Ciano, Magenta, Verde, Giallo). Quando è il tuo turno, ripeti l'esatta sequenza toccando i pad. Ad ogni round la sequenza si allunga e accelera!"
          iconName="radio"
          onStart={() => setIsPlaying(true)}
          onBack={() => navigation.goBack()}
        />

        {isPlaying && (
          <ArcadeGameWebView
            htmlContent={htmlGameContent}
            gameId="SimonDigital"
            routeParams={route.params}
            onExit={() => navigation.goBack()}
            onRestart={() => setIsPlaying(true)}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
