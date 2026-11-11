import React, { useState, useRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { handleGameScoreSubmission } from '../lib/gameUtils';
import { gameStyles } from '../styles/GameStyles';
import GameOverModal from './GameOverModal';

interface ArcadeGameWebViewProps {
  htmlContent: string;
  gameId: string;
  routeParams?: {
    isRoomMode?: boolean;
    roomId?: string;
    playDate?: string;
  };
  onGameOver?: (score: number, finalScore: number) => void;
  onRestart?: () => void;
  onExit?: () => void;
}

export default function ArcadeGameWebView({
  htmlContent,
  gameId,
  routeParams,
  onGameOver,
  onRestart,
  onExit,
}: ArcadeGameWebViewProps) {
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [activeMultiplier, setActiveMultiplier] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [practiceUsed, setPracticeUsed] = useState(false);
  const [isTrainingMode, setIsTrainingMode] = useState(false);

  const webViewRef = useRef<any>(null);

  const handleMessage = async (event: any) => {
    const nativeData = event.nativeEvent.data;

    if (nativeData === 'RESTART' || nativeData === 'RESET') {
      setGameOver(false);
      onRestart?.();
      return;
    }

    let rawScore = 0;
    try {
      const parsed = JSON.parse(nativeData);
      if (parsed.type === 'RESTART' || parsed.type === 'RESET') {
        setGameOver(false);
        onRestart?.();
        return;
      }
      if (parsed.type === 'GAME_OVER' || parsed.score !== undefined) {
        rawScore = parsed.score !== undefined ? parsed.score : (typeof parsed === 'number' ? parsed : 0);
      } else {
        rawScore = parseInt(nativeData, 10) || 0;
      }
    } catch {
      rawScore = parseInt(nativeData, 10) || 0;
    }

    setScore(rawScore);

    const res = await handleGameScoreSubmission({
      gameId,
      rawScore,
      routeParams,
    });

    setActiveMultiplier(res.activeMultiplier);
    setFinalScore(res.computedFinalScore);
    setStatusMessage(res.statusMessage);
    setAttemptsUsed(res.attemptsUsed);
    setPracticeUsed(res.practiceUsed);
    setIsTrainingMode(res.isTrainingMode);
    setGameOver(true);

    onGameOver?.(rawScore, res.computedFinalScore);
  };

  return (
    <View style={gameStyles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={gameStyles.webView}
        onMessage={handleMessage}
        scrollEnabled={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={['*']}
      />

      <GameOverModal
        visible={gameOver}
        score={score}
        finalScore={finalScore}
        isTrainingMode={isTrainingMode}
        multiplier={activeMultiplier}
        statusMessage={statusMessage}
        onRestart={() => {
          setGameOver(false);
          onRestart?.();
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript('if (typeof resetGame === "function") { resetGame(); } true;');
          }
        }}
        onExit={onExit}
      />
    </View>
  );
}
