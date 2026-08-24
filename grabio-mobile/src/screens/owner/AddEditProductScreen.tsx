import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Image, Switch, Modal, Pressable, Platform,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS } from '../../theme';

type Route = RouteProp<RootStackParamList, 'AddEditProduct'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AddEditProductScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const isEdit = !!params.productId;
  const [limitedEdit, setLimitedEdit] = useState(false);
  const [originalProductType, setOriginalProductType] = useState<string>('simple');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');
  const [productType, setProductType] = useState<'simple' | 'service'>('simple');
  const [expiryTracking, setExpiryTracking] = useState(false);
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [expiryAlertDays, setExpiryAlertDays] = useState('30');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [inStock, setInStock] = useState(true);
  const [currency, setCurrency] = useState('USD');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    firestore()
      .collection('products')
      .doc(params.productId!)
      .get()
      .then((doc) => {
        if (doc.exists()) {
          const d = doc.data()!;
          setName(d.name || '');
          setDescription(d.description || '');
          setUnit(d.unit || '');
          const pt = String(d.productType || 'simple');
          setOriginalProductType(pt);
          setProductType(pt === 'service' ? 'service' : 'simple');
          if (pt !== 'simple' && pt !== 'service') {
            setLimitedEdit(true);
          }
          setPrice(String(d.sellingPrice ?? d.price ?? ''));
          setExpiryTracking(!!d.expiryTracking);
          setExpiryAlertDays(String(d.expiryAlertDays || 30));
          if (d.expiryDate && typeof d.expiryDate === 'string') {
            const parsed = new Date(d.expiryDate);
            if (!isNaN(parsed.getTime())) { setExpiryDate(parsed); setTempDate(parsed); }
          }
          setLowStockThreshold(String(d.lowStockThreshold || 5));
          setInStock(d.inStock !== false);
          setCurrency(d.currency || 'USD');
          setExistingImageUrl(d.imageUrl || d.image || null);
        }
        setLoadingData(false);
      });
  }, [isEdit, params.productId]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera roll access is required to upload images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string): Promise<string> => {
    const filename = `${Date.now()}.jpg`;
    // Use storeId as the path segment (matches storage.rules)
    const pathId = user!.storeId || user!.uid;
    const ref = storage().ref(`products/images/${pathId}/${filename}`);
    await ref.putFile(uri);
    return ref.getDownloadURL();
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Product name is required'); return; }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) { Alert.alert('Error', 'Enter a valid price'); return; }

    setLoading(true);
    try {
      let imageUrl = existingImageUrl;
      if (imageUri) {
        imageUrl = await uploadImage(imageUri);
      }

      const data: Record<string, unknown> = limitedEdit
        ? {
            name: name.trim(),
            price: priceNum,
            sellingPrice: priceNum,
            inStock,
            currency,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          }
        : {
            name: name.trim(),
            description: description.trim() || null,
            price: priceNum,
            unit: unit.trim() || null,
            productType,
            inStock,
            currency,
            storeId: user!.storeId,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          };
      if (imageUrl) { data.imageUrl = imageUrl; data.image = imageUrl; }
      if (!limitedEdit) {
        // Low stock threshold only for simple products
        if (productType === 'simple' && lowStockThreshold !== '') {
          data.lowStockThreshold = parseInt(lowStockThreshold, 10);
        }
        data.expiryTracking = expiryTracking;
        data.expiryAlertDays = parseInt(expiryAlertDays, 10) || 30;
        if (expiryTracking && expiryDate) {
          const y = expiryDate.getFullYear();
          const m = String(expiryDate.getMonth() + 1).padStart(2, '0');
          const d2 = String(expiryDate.getDate()).padStart(2, '0');
          data.expiryDate = `${y}-${m}-${d2}`;
        }
        if (productType === 'service') { data.inStock = true; }
      }

      if (isEdit) {
        await firestore().collection('products').doc(params.productId).update(data);
      } else {
        data.createdAt = firestore.FieldValue.serverTimestamp();
        await firestore().collection('products').add(data);
      }

      navigation.goBack();
    } catch (err: unknown) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />;

  const displayImage = imageUri || existingImageUrl;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {limitedEdit ? (
        <View style={styles.limitedBanner}>
          <Text style={styles.limitedBannerText}>
            Quick edit for {originalProductType.replace('_', ' ')} — recipe/BOM changes stay on web admin.
          </Text>
        </View>
      ) : null}
      {/* Image Section */}
      {displayImage ? (
        <Image source={{ uri: displayImage }} style={styles.previewImage} />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={{ fontSize: 40 }}>📷</Text>
          <Text style={styles.imagePlaceholderText}>Add product photo</Text>
        </View>
      )}
      <View style={styles.imageButtons}>
        <TouchableOpacity style={styles.imgBtn} onPress={pickImage}>
          <Text style={styles.imgBtnText}>📁 Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.imgBtn} onPress={takePhoto}>
          <Text style={styles.imgBtnText}>📸 Camera</Text>
        </TouchableOpacity>
      </View>

      {/* Form Fields */}
      <Text style={styles.label}>Product Name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Fresh Tomatoes" placeholderTextColor="#9ca3af" />

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, { height: 70 }]} value={description} onChangeText={setDescription} placeholder="Optional description" multiline placeholderTextColor="#9ca3af" editable={!limitedEdit} />

      <View style={styles.row}>
        <View style={{ flex: 2 }}>
          <Text style={styles.label}>Price *</Text>
          <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#9ca3af" />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.label}>Currency</Text>
          <TextInput style={styles.input} value={currency} onChangeText={setCurrency} placeholder="USD" autoCapitalize="characters" placeholderTextColor="#9ca3af" />
        </View>
      </View>

      <Text style={styles.label}>Unit (optional)</Text>
      <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="e.g. kg, piece, liter" placeholderTextColor="#9ca3af" editable={!limitedEdit} />

      {!limitedEdit ? (
      <>
      {/* Product Type */}
      <Text style={styles.label}>Product Type *</Text>
      <View style={styles.typeRow}>
        <TouchableOpacity
          style={[styles.typeBtn, productType === 'simple' && styles.typeBtnActive]}
          onPress={() => setProductType('simple')}
        >
          <Text style={[styles.typeBtnText, productType === 'simple' && styles.typeBtnTextActive]}>📦 Simple Product</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, productType === 'service' && styles.typeBtnActive]}
          onPress={() => setProductType('service')}
        >
          <Text style={[styles.typeBtnText, productType === 'service' && styles.typeBtnTextActive]}>🔧 Service</Text>
        </TouchableOpacity>
      </View>

      {/* Expiry Tracking */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>Enable Expiry Tracking</Text>
        <Switch value={expiryTracking} onValueChange={setExpiryTracking} trackColor={{ true: COLORS.primary }} />
      </View>
      {expiryTracking && (
        <>
          <Text style={styles.label}>Expiry Date</Text>
          <TouchableOpacity style={styles.datePickerBtn} onPress={() => { setTempDate(expiryDate || new Date()); setShowDatePicker(true); }}>
            <Text style={styles.datePickerBtnText}>
              {expiryDate
                ? `📅 ${String(expiryDate.getDate()).padStart(2,'0')}/${String(expiryDate.getMonth()+1).padStart(2,'0')}/${expiryDate.getFullYear()}`
                : '📅 Select expiry date…'}
            </Text>
          </TouchableOpacity>

          {/* Date Picker Modal */}
          <Modal visible={showDatePicker} transparent animationType="slide">
            <Pressable style={styles.dateModalOverlay} onPress={() => setShowDatePicker(false)}>
              <Pressable style={styles.dateModalBox} onPress={() => {}}>
                <Text style={styles.dateModalTitle}>Select Expiry Date</Text>
                {/* Year / Month / Day pickers as scroll wheels */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  {/* Day */}
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.dateColLabel}>Day</Text>
                    <ScrollView style={styles.dateScroll} showsVerticalScrollIndicator={false}>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <TouchableOpacity key={d} style={[styles.dateCell, tempDate.getDate() === d && styles.dateCellActive]} onPress={() => { const nd = new Date(tempDate); nd.setDate(d); setTempDate(nd); }}>
                          <Text style={[styles.dateCellText, tempDate.getDate() === d && styles.dateCellTextActive]}>{String(d).padStart(2,'0')}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  {/* Month */}
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.dateColLabel}>Month</Text>
                    <ScrollView style={styles.dateScroll} showsVerticalScrollIndicator={false}>
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((mo, idx) => (
                        <TouchableOpacity key={mo} style={[styles.dateCell, tempDate.getMonth() === idx && styles.dateCellActive]} onPress={() => { const nd = new Date(tempDate); nd.setMonth(idx); setTempDate(nd); }}>
                          <Text style={[styles.dateCellText, tempDate.getMonth() === idx && styles.dateCellTextActive]}>{mo}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  {/* Year */}
                  <View style={{ flex: 1.2, alignItems: 'center' }}>
                    <Text style={styles.dateColLabel}>Year</Text>
                    <ScrollView style={styles.dateScroll} showsVerticalScrollIndicator={false}>
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() + i).map((yr) => (
                        <TouchableOpacity key={yr} style={[styles.dateCell, tempDate.getFullYear() === yr && styles.dateCellActive]} onPress={() => { const nd = new Date(tempDate); nd.setFullYear(yr); setTempDate(nd); }}>
                          <Text style={[styles.dateCellText, tempDate.getFullYear() === yr && styles.dateCellTextActive]}>{yr}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity style={[styles.dateModalBtn, { backgroundColor: '#f3f4f6' }]} onPress={() => setShowDatePicker(false)}>
                    <Text style={{ color: COLORS.textSecondary, fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.dateModalBtn, { backgroundColor: COLORS.primary, flex: 2 }]} onPress={() => { setExpiryDate(new Date(tempDate)); setShowDatePicker(false); }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          <Text style={styles.label}>Alert Days Before Expiry</Text>
          <TextInput style={styles.input} value={expiryAlertDays} onChangeText={setExpiryAlertDays} keyboardType="number-pad" placeholder="30" placeholderTextColor="#9ca3af" />
        </>
      )}

      {/* Low stock and in-stock only for simple products */}
      {productType === 'simple' && (
        <>
          <Text style={styles.label}>Low Stock Alert Threshold</Text>
          <TextInput style={styles.input} value={lowStockThreshold} onChangeText={setLowStockThreshold} keyboardType="number-pad" placeholder="5" placeholderTextColor="#9ca3af" />
          <View style={styles.switchRow}>
            <Text style={styles.label}>In Stock</Text>
            <Switch value={inStock} onValueChange={setInStock} trackColor={{ true: COLORS.primary }} />
          </View>
        </>
      )}
      </>
      ) : (
        <View style={styles.switchRow}>
          <Text style={styles.label}>In Stock</Text>
          <Switch value={inStock} onValueChange={setInStock} trackColor={{ true: COLORS.primary }} />
        </View>
      )}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes' : 'Create Product'}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  previewImage: { width: '100%', height: 200, borderRadius: RADIUS.lg, resizeMode: 'cover', marginBottom: 10 },
  imagePlaceholder: { width: '100%', height: 160, backgroundColor: '#f3f4f6', borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  imagePlaceholderText: { color: '#9ca3af', marginTop: 6 },
  imageButtons: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  imgBtn: { flex: 1, backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md, padding: 10, alignItems: 'center' },
  imgBtnText: { color: COLORS.primary, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: RADIUS.md, padding: 12, fontSize: 15, backgroundColor: '#f9fafb', color: '#1A202C' },
  row: { flexDirection: 'row' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingVertical: 8 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40, height: 52, justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  typeBtn: { flex: 1, borderWidth: 1.5, borderColor: '#d1d5db', borderRadius: RADIUS.md, padding: 12, alignItems: 'center' },
  typeBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  typeBtnText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  typeBtnTextActive: { color: COLORS.primary },
  datePickerBtn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: RADIUS.md, padding: 14, backgroundColor: '#f9fafb', marginBottom: 8 },
  datePickerBtnText: { fontSize: 14, color: COLORS.textPrimary, fontWeight: '600' },
  dateModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  dateModalBox: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  dateModalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16, textAlign: 'center' },
  dateColLabel: { fontSize: 12, color: COLORS.textMuted, marginBottom: 4, fontWeight: '600' },
  dateScroll: { height: 160, width: '100%' },
  dateCell: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: RADIUS.md, alignItems: 'center' },
  dateCellActive: { backgroundColor: COLORS.primary },
  dateCellText: { fontSize: 15, color: COLORS.textSecondary },
  dateCellTextActive: { color: '#fff', fontWeight: '700' },
  dateModalBtn: { flex: 1, padding: 14, borderRadius: RADIUS.md, alignItems: 'center' },
  limitedBanner: { backgroundColor: '#fef3c7', borderRadius: RADIUS.md, padding: 12, marginBottom: 12 },
  limitedBannerText: { fontSize: 13, color: '#92400e', lineHeight: 18 },
});
