import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface PreGameModalProps {
  visible: boolean;
  title: string;
  description: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  onStart: () => void;
  onBack?: () => void;
}

export default function PreGameModal({
  visible,
  title,
  description,
  iconName = 'game-controller',
  onStart,
  onBack,
}: PreGameModalProps) {
  if (!visible) return null;

  // Task 1: Sanitize title to prevent duplicate "MISSION BRIEFING //"
  const cleanTitle = title.replace(/^MISSION BRIEFING\s*(\/\/|-)\s*/i, '').trim();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <BlurView intensity={95} tint="dark" style={styles.tutorialContainer}>
        <LinearGradient colors={['#050B14', '#112240']} style={styles.tutorialCard}>
          <Ionicons name={iconName} size={54} color="#00E5FF" style={{ marginBottom: 16 }} />
          <Text style={styles.tutorialTitle}>MISSION BRIEFING // {cleanTitle}</Text>
          <Text style={styles.tutorialText}>{description}</Text>
          
          <View style={styles.tutorialBtnRow}>
            {onBack && (
              <TouchableOpacity 
                style={[styles.tutBtn, { backgroundColor: 'rgba(0,0,0,0.3)' }]} 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onBack();
                }}
              >
                <Ionicons name="arrow-back" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.tutBtnText}>INDIETRO</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.tutBtn, { backgroundColor: '#00E5FF' }]} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onStart();
              }}
            >
              <Ionicons name="play" size={18} color="#050B14" style={{ marginRight: 6 }} />
              <Text style={[styles.tutBtnText, { color: '#050B14' }]}>AVVIA TEST</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tutorialContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(5, 11, 20, 0.95)',
  },
  tutorialCard: {
    width: '100%',
    maxWidth: 500,
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#00E5FF',
    shadowRadius: 30,
    shadowOpacity: 0.3,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  tutorialTitle: {
    color: '#00E5FF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  tutorialText: {
    color: '#EAF4FF',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  tutorialBtnRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  tutBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutBtnText: {
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 1,
    color: '#FFF',
  },
});
