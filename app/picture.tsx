import { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useDailyPicture, type ArchiveEntry } from '../hooks/useDailyPicture';
import { useCoupleContext } from '../lib/coupleContext';
import { AsyncError } from '../components/AsyncError';
import { Press } from '../components/Press';
import { Screen } from '../components/Screen';
import { Skeleton } from '../components/Skeleton';
import { c, radius, s, shadow, space } from '../components/theme';

function ArchiveRow({ entry, mine }: { entry: ArchiveEntry; mine: boolean }) {
  return (
    <View style={styles.entry}>
      {entry.url && <Image source={{ uri: entry.url }} style={styles.entryImage} />}
      <Text style={styles.entryMeta}>{entry.submission_date} · {mine ? 'from you' : 'from them'}</Text>
    </View>
  );
}

export default function Picture() {
  const { userId, coupleId, timezone } = useCoupleContext();
  const { mySubmissionToday, partnerSubmissionToday, archive, uploading, uploadToday, refresh, refreshArchive } = useDailyPicture(coupleId, userId, timezone ?? 'UTC');
  const [uri, setUri] = useState<string>();
  const [error, setError] = useState<string | null>(null);

  // Re-read each time the screen is opened: the partner may have shared theirs
  // while this was in the background.
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshArchive();
    }, [refresh, refreshArchive]),
  );

  const pick = async () => {
    if (uploading) return;
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .8 });
      if (!result.canceled) setUri(result.assets[0].uri);
    } catch {
      setError('Could not open your gallery.');
    }
  };

  const upload = async () => {
    if (!uri || uploading) return;
    setError(null);
    try {
      const result = await uploadToday(uri);
      if (result.alreadySubmittedToday) setError('You already shared a picture today.');
      else setUri(undefined);
    } catch {
      setError('Could not upload your picture.');
    }
  };

  const done = mySubmissionToday && !uri;

  return (
    <Screen topInset={false}>
      <Text style={s.eyebrow}>TODAY'S PICTURE</Text>
      <Text style={s.title}>A frame from your day.</Text>
      <Text style={styles.lede}>No pressure. The ordinary moments are usually the good stuff.</Text>

      <Press
        style={[styles.upload, (uri || mySubmissionToday) && styles.uploadDone, shadow.soft]}
        onPress={() => { void pick(); }}
        disabled={uploading}
        accessibilityLabel={uri ? 'Change selected picture' : mySubmissionToday ? 'Picture already shared today' : 'Choose a picture'}
      >
        <View style={[styles.iconBubble, (uri || done) && styles.iconBubbleDone]}>
          <Text style={styles.icon}>{uri || done ? '✓' : '+'}</Text>
        </View>
        <Text style={styles.uploadTitle}>
          {uri ? 'Picture selected' : done ? 'Today’s picture is shared' : 'Choose a picture'}
        </Text>
        <Text style={styles.uploadHint}>
          {uri
            ? 'Tap to pick a different one'
            : done
              ? (partnerSubmissionToday ? 'They shared theirs too' : 'Waiting for theirs')
              : 'Tap to pick from your gallery'}
        </Text>
      </Press>

      {uri && (
        <View>
          <Press
            style={[s.primary, styles.send, uploading && styles.busy]}
            disabled={uploading}
            onPress={() => { void upload(); }}
            accessibilityLabel="Send picture to your partner"
          >
            <Text style={s.primaryText}>{uploading ? 'Uploading…' : 'Send it to your person'}</Text>
          </Press>
          {error !== null && (
            <AsyncError message={error} retryLabel="Try again" onRetry={() => { void upload(); }} />
          )}
        </View>
      )}
      {!uri && error !== null && (
        <AsyncError message={error} retryLabel="Try again" onRetry={() => { void pick(); }} />
      )}

      <Text style={styles.section}>ARCHIVE</Text>
      {archive === null && (
        <View style={styles.skeleton}>
          <Skeleton height={180} radius={radius.md} />
          <Skeleton height={180} radius={radius.md} style={styles.skeletonRow} />
        </View>
      )}
      {archive !== null && archive.length === 0 && (
        <View style={styles.empty}>
          <Text style={s.body}>Your shared picture archive will appear here.</Text>
        </View>
      )}
      {archive?.map((entry) => <ArchiveRow key={entry.id} entry={entry} mine={entry.user_id === userId} />)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: { color: c.muted, fontSize: 15, lineHeight: 22, marginTop: space.md },
  upload: {
    alignItems: 'center',
    backgroundColor: c.blush,
    borderColor: c.coral,
    borderRadius: radius.xl,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: space.xxl,
    minHeight: 230,
    padding: space.xl,
  },
  uploadDone: { backgroundColor: c.sage, borderColor: c.sageDeep, borderStyle: 'solid' },
  iconBubble: { alignItems: 'center', backgroundColor: c.paper, borderRadius: 30, height: 60, justifyContent: 'center', width: 60 },
  iconBubbleDone: { backgroundColor: c.white },
  icon: { color: c.coral, fontSize: 30, lineHeight: 34 },
  uploadTitle: { color: c.ink, fontFamily: 'Georgia', fontSize: 23, marginTop: space.lg, textAlign: 'center' },
  uploadHint: { color: c.inkSoft, fontSize: 13, marginTop: space.xs, textAlign: 'center' },
  send: { marginTop: space.lg },
  busy: { opacity: 0.6 },
  section: { color: c.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginBottom: space.md, marginTop: space.xxl },
  skeleton: { gap: space.lg },
  skeletonRow: { marginTop: space.lg },
  empty: { borderColor: c.line, borderRadius: radius.md, borderWidth: 1, padding: space.lg },
  entry: { marginBottom: space.lg },
  entryImage: { backgroundColor: c.paper, borderColor: c.line, borderRadius: radius.md, borderWidth: 1, height: 220, width: '100%' },
  entryMeta: { color: c.muted, fontSize: 11, marginTop: space.sm },
});
