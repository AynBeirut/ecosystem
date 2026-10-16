import React, { useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import ScreenSafeArea from './ScreenSafeArea';
import { COLORS, RADIUS } from '../theme';

type Props = {
  visible: boolean;
  saving?: boolean;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
};

const webStyle = `
  .m-signature-pad--footer { display: none !important; }
  .m-signature-pad {
    box-shadow: none;
    border: none;
    margin: 0;
    width: 100%;
    height: 100%;
  }
  .m-signature-pad--body {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    height: 100%;
    border: none;
  }
  .rotated-false { width: 100%; height: 100%; }
  body, html { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }
`;

export default function SignaturePadModal({ visible, saving, onClose, onSave }: Props) {
  const ref = useRef<SignatureCanvas>(null);
  const { height: windowHeight } = useWindowDimensions();
  const padHeight = Math.max(320, windowHeight - 240);

  const handleSavePress = () => {
    ref.current?.readSignature();
  };

  const handleClearPress = () => {
    ref.current?.clearSignature();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScreenSafeArea edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>Draw signature</Text>
          <Text style={styles.subtitle}>Use your finger anywhere in the box below</Text>
        </View>

        <View style={[styles.padWrap, { height: padHeight }]}>
          <SignatureCanvas
            ref={ref}
            onOK={onSave}
            onEmpty={() => Alert.alert('No signature', 'Draw your signature on the pad first.')}
            descriptionText=""
            clearText=""
            confirmText=""
            webStyle={webStyle}
            backgroundColor="#ffffff"
            penColor="#1A202C"
            imageType="image/png"
            style={styles.pad}
            webviewProps={{
              scrollEnabled: false,
              bounces: false,
              androidLayerType: 'software',
            }}
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.clearBtn} onPress={handleClearPress} disabled={saving}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSavePress} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveText}>Save signature</Text>
            )}
          </TouchableOpacity>
        </View>

        {saving ? <Text style={styles.savingText}>Uploading signature…</Text> : null}

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScreenSafeArea>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface, padding: 16 },
  header: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  padWrap: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  pad: { flex: 1, width: '100%', height: '100%' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  clearBtn: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  clearText: { fontWeight: '700', color: COLORS.textSecondary },
  saveBtn: {
    flex: 1.4,
    padding: 14,
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  saveText: { fontWeight: '800', color: '#fff', fontSize: 15 },
  savingText: { textAlign: 'center', color: COLORS.textMuted, fontSize: 12, marginTop: 8 },
  cancelBtn: {
    marginTop: 10,
    padding: 14,
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  cancelText: { fontWeight: '700', color: COLORS.textSecondary },
});
