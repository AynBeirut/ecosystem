import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Image, Switch,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';

type Route = RouteProp<RootStackParamList, 'AddEditProduct'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AddEditProductScreen() {
  const { params } = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const isEdit = !!params.productId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');
  const [stock, setStock] = useState('');
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
          setPrice(String(d.price || ''));
          setUnit(d.unit || '');
          setStock(d.stock !== undefined ? String(d.stock) : '');
          setLowStockThreshold(String(d.lowStockThreshold || 5));
          setInStock(d.inStock !== false);
          setCurrency(d.currency || 'USD');
          setExistingImageUrl(d.imageUrl || null);
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    const ref = storage().ref(`products/images/${user!.uid}/${filename}`);
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

      const data: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || null,
        price: priceNum,
        unit: unit.trim() || null,
        inStock,
        currency,
        storeId: user!.storeId,
        productType: 'simple',
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };
      if (imageUrl) data.imageUrl = imageUrl;
      if (stock !== '') data.stock = parseInt(stock, 10);
      if (lowStockThreshold !== '') data.lowStockThreshold = parseInt(lowStockThreshold, 10);

      if (isEdit) {
        await firestore().collection('products').doc(params.productId).update(data);
      } else {
        data.createdAt = firestore.FieldValue.serverTimestamp();
        await firestore().collection('products').add(data);
      }

      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) return <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />;

  const displayImage = imageUri || existingImageUrl;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
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
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Fresh Tomatoes" />

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, { height: 70 }]} value={description} onChangeText={setDescription} placeholder="Optional description" multiline />

      <View style={styles.row}>
        <View style={{ flex: 2 }}>
          <Text style={styles.label}>Price *</Text>
          <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.label}>Currency</Text>
          <TextInput style={styles.input} value={currency} onChangeText={setCurrency} placeholder="USD" autoCapitalize="characters" />
        </View>
      </View>

      <Text style={styles.label}>Unit (optional)</Text>
      <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="e.g. kg, piece, liter" />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Stock Quantity</Text>
          <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="number-pad" placeholder="Leave blank if unlimited" />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.label}>Low Stock Alert</Text>
          <TextInput style={styles.input} value={lowStockThreshold} onChangeText={setLowStockThreshold} keyboardType="number-pad" placeholder="5" />
        </View>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>In Stock</Text>
        <Switch value={inStock} onValueChange={setInStock} trackColor={{ true: '#6366f1' }} />
      </View>

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
  previewImage: { width: '100%', height: 200, borderRadius: 12, resizeMode: 'cover', marginBottom: 10 },
  imagePlaceholder: { width: '100%', height: 160, backgroundColor: '#f3f4f6', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  imagePlaceholderText: { color: '#9ca3af', marginTop: 6 },
  imageButtons: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  imgBtn: { flex: 1, backgroundColor: '#e0e7ff', borderRadius: 8, padding: 10, alignItems: 'center' },
  imgBtnText: { color: '#6366f1', fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: '#f9fafb' },
  row: { flexDirection: 'row' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingVertical: 8 },
  saveBtn: { backgroundColor: '#6366f1', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40, height: 52, justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
