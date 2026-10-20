import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { supabase } from '../lib/supabase';

// UUID fisso temporaneo per simulare l'utente corrente prima dell'integrazione auth completa
const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001';
const CURRENT_USER_NAME = 'CyberTraveler';

export interface ChatMessage {
  id: string | number;
  user_id?: string;
  user_name?: string;
  content: string;
  created_at: string;
}

export default function GlobalChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchInitialMessages();

    // Sottoscrizione realtime agli eventi INSERT sulla tabella chat_messages
    const channel = supabase
      .channel('custom-all-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prevMessages) => {
            // Evita duplicati se il messaggio è già presente
            if (prevMessages.some((msg) => msg.id === newMsg.id)) {
              return prevMessages;
            }
            return [...prevMessages, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInitialMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Errore durante la lettura dei messaggi:', error.message);
      } else if (data) {
        setMessages(data);
      }
    } catch (err) {
      console.error('Eccezione durante il recupero dei messaggi:', err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setInputText('');

    try {
      const { error } = await supabase.from('chat_messages').insert([
        {
          user_id: CURRENT_USER_ID,
          user_name: CURRENT_USER_NAME,
          content: trimmed,
        },
      ]);

      if (error) {
        console.error("Errore durante l'inserimento del messaggio:", error.message);
      }
    } catch (err) {
      console.error("Eccezione durante l'invio del messaggio:", err);
    } finally {
      setSending(false);
    }
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isMine = item.user_id === CURRENT_USER_ID;
    const formattedTime = item.created_at
      ? new Date(item.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return (
      <View
        style={[
          styles.messageRow,
          isMine ? styles.myMessageRow : styles.otherMessageRow,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isMine ? styles.myBubble : styles.otherBubble,
          ]}
        >
          {!isMine && (
            <Text style={styles.senderName}>{item.user_name || 'Anonimo'}</Text>
          )}

          <Text style={[styles.messageContent, isMine ? styles.myMessageText : styles.otherMessageText]}>
            {item.content}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.timeText}>{formattedTime}</Text>
            {isMine && <Text style={styles.checkIcon}>✓✓</Text>}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0D17" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#00F0FF" />
            <Text style={styles.loaderText}>Connessione al canale...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMessageItem}
            contentContainerStyle={styles.listContainer}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            onLayout={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            placeholder="Scrivi un messaggio..."
            placeholderTextColor="#6C7293"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0D17',
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#0E121E',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    color: '#6C7293',
    fontSize: 14,
  },
  listContainer: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageRow: {
    width: '100%',
    marginVertical: 4,
    flexDirection: 'row',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  myBubble: {
    backgroundColor: '#005C4B',
    borderBottomRightRadius: 2,
    borderWidth: 1,
    borderColor: '#00A884',
  },
  otherBubble: {
    backgroundColor: '#1E2538',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#2A334E',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00F0FF',
    marginBottom: 4,
  },
  messageContent: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#E9EDEF',
  },
  otherMessageText: {
    color: '#FFFFFF',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
    color: '#8696A0',
  },
  checkIcon: {
    fontSize: 10,
    color: '#53BDEB',
    marginLeft: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#121624',
    borderTopWidth: 1,
    borderTopColor: '#1A2136',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#1C2337',
    color: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2B3552',
    marginRight: 8,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#00A884',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
    shadowColor: '#00A884',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#273145',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 2,
  },
});
