import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { fetchStoreProfile, saveFinanceDocumentFields } from '../../lib/financeService';
import { pickAndUploadDocumentImage } from '../../lib/documentImageUpload';
import { COLORS } from '../../theme';

export default function InvoiceHeaderScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logo, setLogo] = useState('');
  const [signature, setSignature] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [signer, setSigner] = useState('');
  const [headOn, setHeadOn] = useState(false);
  const [headNote, setHeadNote] = useState('');
  const [footOn, setFootOn] = useState(false);
  const [footNote, setFootNote] = useState('');
  const [paidStamp, setPaidStamp] = useState(false);
  const [showName, setShowName] = useState(true);
  const [contactOnHeader, setContactOnHeader] = useState(true);

  useEffect(() => {
    if (!user?.storeId) return;
    void fetchStoreProfile(user.storeId).then((data) => {
      const doc = (data?.financeDocumentSettings ?? {}) as Record<string, unknown>;
      const profile = (data || {}) as Record<string, unknown>;
      setLogo(String(doc.documentLogo || profile.logo || ''));
      setSignature(String(doc.signature || ''));
      setCompanyName(String(doc.documentCompanyName || profile.name || ''));
      setTaxId(String(doc.documentTaxId || profile.taxNumber || ''));
      setAddress(String(doc.documentAddress || profile.location || ''));
      setPhone(String(doc.documentPhone || profile.phone || ''));
      setEmail(String(doc.documentEmail || profile.email || ''));
      setWebsite(String(doc.documentWebsite || profile.website || ''));
      setSigner(String(doc.documentSignatoryName || ''));
      setHeadOn(Boolean(doc.documentHeadNoteEnabled));
      setHeadNote(String(doc.documentHeadNote || ''));
      setFootOn(Boolean(doc.documentFootNoteEnabled));
      setFootNote(String(doc.documentFooterNote || doc.documentFooter || ''));
      setPaidStamp(Boolean(doc.documentPaidStamp));
      setShowName(doc.documentShowCompanyName !== false);
      setContactOnHeader(doc.documentContactPlacement !== 'footer');
      setLoading(false);
    });
  }, [user?.storeId]);

  const pick = async (kind: 'logo' | 'signature') => {
    try {
      const url = await pickAndUploadDocumentImage(kind);
      if (!url) return;
      if (kind === 'logo') setLogo(url);
      else setSignature(url);
    } catch (e) {
      Alert.alert('Image failed', e instanceof Error ? e.message : 'Could not update the image');
    }
  };

  const save = async () => {
    if (!user?.storeId) return;
    setSaving(true);
    try {
      await saveFinanceDocumentFields(user.storeId, {
        documentLogo: logo,
        documentShowLogo: Boolean(logo),
        signature,
        documentCompanyName: companyName.trim(),
        documentTaxId: taxId.trim(),
        documentAddress: address.trim(),
        documentPhone: phone.trim(),
        documentEmail: email.trim(),
        documentWebsite: website.trim(),
        documentSignatoryName: signer.trim(),
        documentHeadNoteEnabled: headOn,
        documentHeadNote: headNote.trim(),
        documentFootNoteEnabled: footOn,
        documentFooterNote: footNote.trim(),
        documentFooter: footOn ? footNote.trim() : '',
        documentPaidStamp: paidStamp,
        documentShowCompanyName: showName,
        documentContactPlacement: contactOnHeader ? 'hero' : 'footer',
      });
      Alert.alert('Saved', 'Invoice header saved.');
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save the header');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.cards}>
        <ImageCard label="Logo" uri={logo} onEdit={() => void pick('logo')} onDelete={() => setLogo('')} />
        <ImageCard label="Signature" uri={signature} onEdit={() => void pick('signature')} onDelete={() => setSignature('')} />
      </View>
      <ChoiceRow
        label="Business name"
        value={showName ? 'show' : 'hide'}
        options={[['show', 'Show'], ['hide', 'Hide']]}
        onChange={(id) => setShowName(id === 'show')}
      />
      <ChoiceRow
        label="Address and website"
        value={contactOnHeader ? 'header' : 'footer'}
        options={[['header', 'Header'], ['footer', 'Footer']]}
        onChange={(id) => setContactOnHeader(id === 'header')}
      />
      <Field label="Company name" value={companyName} onChange={setCompanyName} />
      <Field label="Tax id" value={taxId} onChange={setTaxId} />
      <Field label="Address" value={address} onChange={setAddress} />
      <Field label="Phone number" value={phone} onChange={setPhone} keyboard="phone-pad" />
      <Field label="Email address" value={email} onChange={setEmail} keyboard="email-address" />
      <Field label="Website" value={website} onChange={setWebsite} />
      <Field label="Signer name" value={signer} onChange={setSigner} />

      <NoteRow title="Default head note" on={headOn} setOn={setHeadOn} note={headNote} setNote={setHeadNote} />
      <NoteRow title="Default foot note" on={footOn} setOn={setFootOn} note={footNote} setNote={setFootNote} />

      <View style={styles.noteRow}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.noteTitle}>Paid stamp</Text>
          <Text style={styles.noteHint}>Shows a PAID mark on documents that are fully paid.</Text>
        </View>
        <Switch value={paidStamp} onValueChange={setPaidStamp} trackColor={{ false: '#E5E7EB', true: COLORS.primary }} thumbColor="#fff" />
      </View>
      {paidStamp ? (
        <View style={styles.stamp}>
          <Text style={styles.stampText}>PAID</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.save} onPress={() => void save()} disabled={saving}>
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ImageCard({ uri, onEdit, onDelete }: { label: string; uri: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={styles.card}>
      {uri ? <Image source={{ uri }} style={styles.cardImage} resizeMode="contain" /> : <Text style={styles.cardEmpty}>None</Text>}
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={onDelete} style={styles.cardBtn}><Text style={styles.cardBtnText}>Delete</Text></TouchableOpacity>
        <TouchableOpacity onPress={onEdit} style={styles.cardBtn}><Text style={styles.cardBtnText}>Edit</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (id: string) => void;
}) {
  return (
    <View style={styles.choiceBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.choiceRow}>
        {options.map(([id, text]) => (
          <TouchableOpacity key={id} style={[styles.choice, value === id && styles.choiceOn]} onPress={() => onChange(id)}>
            <Text style={[styles.choiceText, value === id && styles.choiceTextOn]}>{text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboard?: 'phone-pad' | 'email-address';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboard}
        autoCapitalize={keyboard === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

function NoteRow({
  title,
  on,
  setOn,
  note,
  setNote,
}: {
  title: string;
  on: boolean;
  setOn: (value: boolean) => void;
  note: string;
  setNote: (value: string) => void;
}) {
  return (
    <View>
      <View style={styles.noteRow}>
        <Text style={styles.noteTitle}>{title}</Text>
        <Switch value={on} onValueChange={setOn} trackColor={{ false: '#E5E7EB', true: COLORS.primary }} thumbColor="#fff" />
      </View>
      {on ? (
        <TextInput
          style={[styles.fieldInput, styles.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder="Note text"
          placeholderTextColor="#9CA3AF"
          multiline
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 16, paddingBottom: 32 },
  cards: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  card: { flex: 1, height: 140, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  cardImage: { width: '100%', height: 100 },
  cardEmpty: { height: 100, textAlign: 'center', textAlignVertical: 'center', color: '#94A3B8', paddingTop: 40 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, paddingHorizontal: 8, paddingBottom: 8 },
  cardBtn: { paddingVertical: 4 },
  cardBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
  choiceBlock: { marginBottom: 12 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  choiceOn: { backgroundColor: '#1C2333', borderColor: '#1C2333' },
  choiceText: { color: COLORS.textPrimary, fontWeight: '700' },
  choiceTextOn: { color: '#fff' },
  field: { marginBottom: 12 },
  fieldLabel: { color: '#3B82F6', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  fieldInput: { backgroundColor: '#fff', color: COLORS.textPrimary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  noteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  noteTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  noteHint: { marginTop: 4, color: '#64748b', fontSize: 13 },
  noteInput: { minHeight: 72, textAlignVertical: 'top', marginBottom: 8 },
  stamp: { alignSelf: 'flex-start', borderWidth: 2, borderColor: '#DC2626', borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 12 },
  stampText: { color: '#DC2626', fontWeight: '800', letterSpacing: 1 },
  save: { marginTop: 12, backgroundColor: '#1C2333', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
