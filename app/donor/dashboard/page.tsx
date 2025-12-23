'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { 
  Upload, 
  Camera, 
  QrCode as QrCodeIcon, 
  Clock, 
  MapPin, 
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Download,
  Plus,
  TrendingUp,
  Heart,
  Users,
  Award,
  BarChart3,
  Calendar,
  Package,
  Home,
  Settings,
  Bell
} from 'lucide-react';
import { aiService } from '@/app/lib/ai-service';
import { generateDonationId, validateImageFile, compressImage, generateQRCode, generateReadableQRCode, generateSimpleQRCode, formatDate, calculateImpactMetrics } from '@/app/lib/utils';
import { Donation, AIPrediction } from '@/app/types';
import QRCode from 'react-qr-code';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LocationPicker from '@/app/components/LocationPicker';
import { Location, LocationService } from '@/app/lib/location-service';
import { donationStorage } from '@/app/lib/donation-storage';
import { useAuth } from '@/app/contexts/AuthContext';
import ImpactDashboard from '@/app/components/ImpactDashboard';
import { useNotifications, createAchievementNotification } from '@/app/contexts/NotificationContext';
import { gamificationService } from '@/app/lib/gamification';
import GamificationDashboard from '@/app/components/GamificationDashboard';
import SocialShare from '@/app/components/SocialShare';

export default function DonorDashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { addNotification } = useNotifications();
  const router = useRouter();
  
  // State
  const [donations, setDonations] = useState<Donation[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [currentDonation, setCurrentDonation] = useState<Partial<Donation> | null>(null);
  const [aiPrediction, setAiPrediction] = useState<AIPrediction | null>(null);
  const [donationLocation, setDonationLocation] = useState<Location | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'donations'>('overview');

  // Check authentication and redirect if needed
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated || !user) {
        router.push('/auth/signin');
        return;
      }
      // Only allow access if user is a donor
      if (user.role !== 'donor') {
        router.push('/'); // Send to home if not a donor
        return;
      }
      setIsLoading(false);
    }
  }, [isAuthenticated, user, authLoading, router]);

  // Load donations from storage on component mount
  useEffect(() => {
    if (user && user.role === 'donor') {
      try {
        donationStorage.updateQRCodes();
        const storedDonations = donationStorage.getDonationsByDonor(user.id);
        setDonations(storedDonations);
        setError(null);
      } catch (err) {
        console.error('Error loading donations:', err);
        setError('Failed to load donations. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  }, [user]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) {
      alert('Please sign in to upload donations.');
      return;
    }

    const file = acceptedFiles[0];
    if (!file || !validateImageFile(file)) {
      alert('Please upload a valid image file (JPEG, PNG, WebP) under 5MB');
      return;
    }

    setIsUploading(true);
    setIsClassifying(true);
    setError(null);

    try {
      const compressedFile = await compressImage(file);
      
      const donationId = generateDonationId();
      const donation: Partial<Donation> = {
        id: donationId,
        imageUrl: URL.createObjectURL(compressedFile),
        createdAt: new Date(),
        status: 'available', // Set to 'available' so it shows up in volunteer/NGO pages
        donorId: user?.id || 'unknown',
        donorName: user?.name || 'Unknown Donor',
        location: {
          lat: 40.7128,
          lng: -74.0060,
          address: 'New York, NY'
        },
        updatedAt: new Date()
      };

      setCurrentDonation(donation);

      try {
        const predictions = await aiService.classifyFoodFromFile(compressedFile);
        const topPrediction = predictions[0];
        
        setAiPrediction(topPrediction);
        
        const foodCategory = aiService.getFoodCategory(topPrediction.className);
        const expiry = aiService.getEstimatedExpiry(foodCategory);
        const quantityEstimate = aiService.getQuantityEstimate(topPrediction.className, compressedFile.size);
        
        const donationWithDetails = {
          ...currentDonation,
          foodType: topPrediction.className,
          foodCategory: foodCategory as any,
          quantity: quantityEstimate.quantity,
          unit: quantityEstimate.unit,
          expiry,
          aiConfidence: topPrediction.probability,
          qrCode: generateQRCode(donationId)
        };
        
        setCurrentDonation(donationWithDetails);
      } catch (error) {
        console.error('AI classification failed:', error);
        const donationWithFallback = {
          ...currentDonation,
          expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };
        setCurrentDonation(donationWithFallback);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setError('Failed to process image. Please try again.');
    } finally {
      setIsUploading(false);
      setIsClassifying(false);
    }
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: false
  });

  const handleSaveDonation = () => {
    if (!currentDonation) {
      alert('No donation to save. Please upload an image first.');
      return;
    }

    if (!currentDonation.foodType || !currentDonation.quantity || !currentDonation.unit) {
      alert('Please fill in all required fields: Food Type, Quantity, and Unit.');
      return;
    }

    if (!currentDonation.expiry || isNaN(currentDonation.expiry.getTime())) {
      currentDonation.expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    // Accept location even if just address is provided (coordinates will be generated)
    if (!currentDonation.location || !currentDonation.location.address) {
      alert('Please enter a pickup location address.');
      return;
    }

    // Ensure location has coordinates (generate if missing)
    if (!currentDonation.location.lat || !currentDonation.location.lng) {
      const coords = LocationService.generateCoordinatesFromAddress(currentDonation.location.address);
      currentDonation.location.lat = coords.lat;
      currentDonation.location.lng = coords.lng;
    }

    try {
      // Ensure all required fields are set
      const donation: Donation = {
        ...currentDonation as Donation,
        id: currentDonation.id || generateDonationId(),
        status: (currentDonation.status as any) || 'available', // Default to 'available'
        donorId: user?.id || currentDonation.donorId || 'unknown',
        donorName: user?.name || currentDonation.donorName || 'Unknown Donor',
        createdAt: currentDonation.createdAt || new Date(),
        updatedAt: new Date(),
        foodCategory: currentDonation.foodCategory || 'other',
        quantity: currentDonation.quantity || 1,
        unit: currentDonation.unit || 'serving',
        expiry: currentDonation.expiry || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        qrCode: currentDonation.qrCode || generateQRCode(currentDonation.id || generateDonationId())
      };

      // Ensure location has all required fields
      if (!donation.location) {
        throw new Error('Location is required');
      }
      if (!donation.location.lat || !donation.location.lng) {
        const coords = LocationService.generateCoordinatesFromAddress(donation.location.address);
        donation.location.lat = coords.lat;
        donation.location.lng = coords.lng;
      }

      donationStorage.addDonation(donation);
      setDonations(prev => [donation, ...prev]);
      setCurrentDonation(null);
      setAiPrediction(null);
      
      addNotification({
        type: 'donation',
        title: 'Donation Created Successfully! 🎉',
        message: `Your donation of ${donation.foodType} (${donation.quantity} ${donation.unit}) has been posted and is now available for pickup.`,
        actionUrl: `/scan/${donation.id}`
      });

      if (user) {
        try {
          const updatedStats = gamificationService.updateStats(user.id, 'donation_created', {
            foodType: donation.foodType,
            quantity: donation.quantity,
            unit: donation.unit
          });

          const oldLevel = updatedStats.currentLevel;
          const newAchievements = updatedStats.achievements.filter(a => a.unlocked && a.unlockedAt && 
            new Date(a.unlockedAt).getTime() > Date.now() - 1000);

          newAchievements.forEach(achievement => {
            addNotification(createAchievementNotification(achievement.name));
          });

          if (updatedStats.currentLevel > oldLevel) {
            const currentLevel = gamificationService.getCurrentLevel(user.id);
            addNotification({
              type: 'achievement',
              title: `Level Up! 🎉`,
              message: `Congratulations! You've reached Level ${updatedStats.currentLevel} - ${currentLevel.title}!`,
              actionUrl: '/donor/dashboard'
            });
          }
        } catch (error) {
          console.error('Error updating gamification stats:', error);
        }
      }
      
      alert('Donation saved successfully!');
    } catch (error) {
      console.error('Error saving donation:', error);
      setError('Failed to save donation. Please try again.');
    }
  };

  const handleDeleteDonation = (id: string) => {
    try {
      donationStorage.deleteDonation(id);
      setDonations(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting donation:', error);
      setError('Failed to delete donation. Please try again.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'picked': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalDonations = donations.length;
  const pendingDonations = donations.filter(d => d.status === 'pending').length;
  const deliveredDonations = donations.filter(d => d.status === 'delivered').length;
  const impactMetrics = calculateImpactMetrics(donations);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-gray-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-sm w-full bg-white rounded-lg p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-medium text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 text-sm mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors text-sm"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-medium text-gray-900 mb-3">Sign in required</h1>
          <p className="text-gray-600 text-sm mb-4">Please sign in to access the dashboard.</p>
          <Link
            href="/auth/signin"
            className="bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors text-sm"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-medium text-gray-900">Donor Dashboard</h1>
            <Link
              href="/scan"
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <QrCodeIcon className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Simple Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            {[
              { id: 'overview', label: 'Overview', icon: Home },
              { id: 'upload', label: 'Upload', icon: Plus },
              { id: 'donations', label: 'Donations', icon: Package }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Simple Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-gray-900">{totalDonations}</p>
                <p className="text-sm text-gray-600">Total</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{pendingDonations}</p>
                <p className="text-sm text-gray-600">Pending</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{deliveredDonations}</p>
                <p className="text-sm text-gray-600">Delivered</p>
              </div>
            </div>

            {/* Impact Dashboard */}
            <div className="bg-white rounded-lg p-6">
              <ImpactDashboard donations={donations} />
            </div>

            {/* Gamification Dashboard */}
            <div className="bg-white rounded-lg p-6">
              <GamificationDashboard />
            </div>

            {/* Social Share */}
            <div className="bg-white rounded-lg p-6">
              <SocialShare impact={impactMetrics} />
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-6">Upload Food</h2>
              
              {/* Simple Dropzone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-gray-400 bg-gray-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input {...getInputProps()} />
                {isUploading ? (
                  <div className="space-y-3">
                    <Loader2 className="w-8 h-8 text-gray-600 animate-spin mx-auto" />
                    <p className="text-gray-600 text-sm">Processing...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {isDragActive ? 'Drop here' : 'Click or drag to upload'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">JPEG, PNG, WebP</p>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Status */}
              {isClassifying && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <span className="text-blue-800 text-sm">Analyzing image...</span>
                  </div>
                </div>
              )}

              {aiPrediction && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-green-800 text-sm font-medium">Detected</span>
                  </div>
                  <p className="text-sm text-green-700">
                    {aiPrediction.className} ({Math.round(aiPrediction.probability * 100)}%)
                  </p>
                </div>
              )}

              {/* Simple Form */}
              {currentDonation && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-md font-medium text-gray-900">Details</h3>
                  
                  {currentDonation.imageUrl && (
                    <img 
                      src={currentDonation.imageUrl} 
                      alt="Food" 
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Food Type</label>
                      <input
                        type="text"
                        value={currentDonation.foodType || ''}
                        onChange={(e) => setCurrentDonation(prev => ({ ...prev, foodType: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        value={currentDonation.quantity || ''}
                        onChange={(e) => setCurrentDonation(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                      <select
                        value={currentDonation.unit || ''}
                        onChange={(e) => setCurrentDonation(prev => ({ ...prev, unit: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-sm"
                      >
                        <option value="">Select</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="l">l</option>
                        <option value="piece">piece</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Expires</label>
                      <input
                        type="datetime-local"
                        value={currentDonation.expiry ? new Date(currentDonation.expiry).toISOString().slice(0, 16) : ''}
                        onChange={(e) => setCurrentDonation(prev => ({ ...prev, expiry: new Date(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                    <LocationPicker
                      onLocationSelect={(location) => {
                        setDonationLocation(location);
                        setCurrentDonation(prev => ({ 
                          ...prev, 
                          location: {
                            lat: location.lat,
                            lng: location.lng,
                            address: location.address
                          }
                        }));
                      }}
                      currentLocation={donationLocation}
                      placeholder="Pickup address..."
                      className="text-sm"
                    />
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={handleSaveDonation}
                      className="flex-1 bg-gray-900 text-white py-2 px-4 rounded-md hover:bg-gray-800 transition-colors text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setCurrentDonation(null);
                        setAiPrediction(null);
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Donations Tab */}
        {activeTab === 'donations' && (
          <div className="bg-white rounded-lg">
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-6">My Donations</h2>
              
              {donations.length === 0 ? (
                <div className="text-center py-12">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No donations yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {donations.map((donation) => (
                    <div
                      key={donation.id}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium text-gray-900 text-sm">{donation.foodType}</h3>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(donation.status)}`}>
                              {donation.status}
                            </span>
                          </div>
                          
                          <div className="text-xs text-gray-600 space-y-1">
                            <p>{donation.quantity} {donation.unit}</p>
                            <p>Expires: {formatDate(donation.expiry)}</p>
                          </div>

                          {donation.qrCode && (
                            <div className="mt-3 text-center">
                              <QRCode 
                                value={generateSimpleQRCode(donation)} 
                                size={80}
                                className="mx-auto"
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {donation.status === 'available' && (
                            <button
                              onClick={() => {
                                // Cancel donation by updating status
                                donationStorage.updateDonation(donation.id, { status: 'expired' });
                                setDonations(prev => prev.filter(d => d.id !== donation.id));
                                alert('Donation cancelled successfully');
                              }}
                              className="text-gray-400 hover:text-yellow-600 p-1"
                              title="Cancel donation"
                            >
                              <AlertCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteDonation(donation.id)}
                            className="text-gray-400 hover:text-red-600 p-1"
                            title="Delete donation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 