import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  StatusBar,
} from 'react-native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface SectionCardProps {
  badge: string;
  title: string;
  subtitle: string;
  accentColor: string;
  onPress: () => void;
}

function SectionCard({ badge, title, subtitle, accentColor, onPress }: SectionCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.card,
        {
          borderColor: accentColor,
          shadowColor: accentColor,
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.badgeContainer, { backgroundColor: `${accentColor}22` }]}>
          <Text style={[styles.badgeText, { color: accentColor }]}>{badge}</Text>
        </View>
        <Text style={[styles.arrow, { color: accentColor }]}>→</Text>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const user = {
    name: 'CyberTraveler',
    energy: 150,
  };

  const handleNavigate = (route: keyof RootStackParamList) => {
    navigation.navigate(route);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0D17" />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header superiore */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>BENTORNATO,</Text>
            <Text style={styles.username}>{user.name}</Text>
          </View>
          <View style={styles.energyPill}>
            <Text style={styles.energyText}>{user.energy}</Text>
            <Text style={styles.energyIcon}>⚡</Text>
          </View>
        </View>

        {/* Titolo sezione */}
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>CENTRO DI CONTROLLO</Text>
          <View style={styles.neonDivider} />
        </View>

        {/* Macro card di navigazione */}
        <View style={styles.cardsContainer}>
          <SectionCard
            badge="01 // RECHARGE"
            title="Ricarica"
            subtitle="Il Paradosso & La Turbina"
            accentColor="#00F0FF"
            onPress={() => handleNavigate('Paradox')}
          />

          <SectionCard
            badge="02 // COMBAT"
            title="Arene Multiplayer"
            subtitle="Dominio 15 & Orbita"
            accentColor="#FF0055"
            onPress={() => handleNavigate('Arenas')}
          />

          <SectionCard
            badge="03 // SOCIAL"
            title="Salotto Sociale"
            subtitle="Chat Globale & L'Impostore"
            accentColor="#39FF14"
            onPress={() => handleNavigate('GlobalChat')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0D17',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E2E',
  },
  greeting: {
    fontSize: 11,
    letterSpacing: 1.5,
    color: '#6C7293',
    fontWeight: '700',
  },
  username: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  energyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B2E',
    borderWidth: 1,
    borderColor: '#FFD700',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#FFD700',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 4,
  },
  energyText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFD700',
    marginRight: 4,
  },
  energyIcon: {
    fontSize: 14,
  },
  sectionTitleContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 2,
    color: '#8A93B0',
    fontWeight: '700',
    marginBottom: 6,
  },
  neonDivider: {
    height: 2,
    backgroundColor: '#1E2538',
    borderRadius: 1,
  },
  cardsContainer: {
    gap: 18,
  },
  card: {
    backgroundColor: '#121624',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 22,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  badgeContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  arrow: {
    fontSize: 22,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
