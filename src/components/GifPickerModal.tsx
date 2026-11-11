import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet, Modal, SafeAreaView, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

const GIPHY_API_KEY = "fXxQ3M5OjRldiZOX4dhvNfawx7NoteoQ";

const FALLBACK_GIFS = [
  { id: '1', title: 'Matrix Code', images: { fixed_height: { url: 'https://media.giphy.com/media/l3vR4CdLInXOhr3rO/giphy.gif' } } },
  { id: '2', title: 'Cyber City', images: { fixed_height: { url: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif' } } },
  { id: '3', title: 'Mind Blown', images: { fixed_height: { url: 'https://media.giphy.com/media/26AHONQ79FdWZhAI0/giphy.gif' } } },
  { id: '4', title: 'Robot Thumbs Up', images: { fixed_height: { url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif' } } },
  { id: '5', title: 'System Fire', images: { fixed_height: { url: 'https://media.giphy.com/media/5nsKxUnzSMC5oGBq74/giphy.gif' } } },
  { id: '6', title: 'Hacker Success', images: { fixed_height: { url: 'https://media.giphy.com/media/xT5LMHxhOfscxPfIfm/giphy.gif' } } },
];

interface GifPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectGif: (url: string) => void;
}

export default function GifPickerModal({ visible, onClose, onSelectGif }: GifPickerModalProps) {
  const [gifs, setGifs] = useState<any[]>(FALLBACK_GIFS);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchTrendingGifs();
    }
  }, [visible]);

  const fetchTrendingGifs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20`);
      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        setGifs(data.data);
      } else {
        setGifs(FALLBACK_GIFS);
      }
    } catch (error) {
      console.log('Giphy API error (using fallback):', error);
      setGifs(FALLBACK_GIFS);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      fetchTrendingGifs();
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20`);
      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        setGifs(data.data);
      } else {
        setGifs([]);
      }
    } catch (error) {
      console.log('Giphy search error:', error);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <SafeAreaView style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>SELEZIONA GIF DAL NETWORK</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#00F0FF" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color="#8A93B0" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Cerca GIF su Giphy..."
              placeholderTextColor="#8A93B0"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                searchGifs(text);
              }}
            />
          </View>

          {loading ? (
            <ActivityIndicator color="#00F0FF" style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={gifs}
              numColumns={2}
              keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
              contentContainerStyle={styles.gridContainer}
              ListEmptyComponent={<Text style={styles.emptyText}>Nessuna GIF trovata.</Text>}
              renderItem={({ item }) => {
                const gifUrl = item.images?.fixed_height?.url || item.url;
                return (
                  <TouchableOpacity 
                    style={styles.gifItem} 
                    onPress={() => onSelectGif(gifUrl)}
                    activeOpacity={0.8}
                  >
                    <ExpoImage source={{ uri: gifUrl }} style={styles.gifImage} contentFit="cover" />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5, 7, 10, 0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0D111A', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '75%', padding: 20, borderWidth: 1, borderColor: '#1E2538' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.2 },
  closeBtn: { padding: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#15192E', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16, borderWidth: 1, borderColor: '#1E2538' },
  searchInput: { flex: 1, color: '#FFF', fontSize: 13 },
  gridContainer: { gap: 12 },
  gifItem: { flex: 1, margin: 4, height: 110, borderRadius: 10, overflow: 'hidden', backgroundColor: '#15192E' },
  gifImage: { width: '100%', height: '100%' },
  emptyText: { color: '#8A93B0', textAlign: 'center', marginTop: 40, fontSize: 13 }
});
