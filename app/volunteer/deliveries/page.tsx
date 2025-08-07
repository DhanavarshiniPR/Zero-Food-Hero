'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Clock, 
  Package, 
  Truck, 
  Navigation,
  Users,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calendar,
  Phone,
  Mail,
  Map,
  Target,
  Route
} from 'lucide-react';
import { Donation, Mission } from '@/app/types';
import { LocationService, Location } from '@/app/lib/location-service';
import { formatDate } from '@/app/lib/utils';
import { donationStorage } from '@/app/lib/donation-storage';

export default function VolunteerDeliveries() {
  const [activeDeliveries, setActiveDeliveries] = useState<(Donation & { distance: number })[]>([]);
  const [completedDeliveries, setCompletedDeliveries] = useState<(Donation & { distance: number })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Donation | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<'idle' | 'delivering' | 'success' | 'error'>('idle');
  const [volunteerLocation, setVolunteerLocation] = useState<Location | undefined>(undefined);

  // Load volunteer's location from localStorage or use current location
  useEffect(() => {
    const savedLocation = localStorage.getItem('volunteerLocation');
    if (savedLocation) {
      try {
        setVolunteerLocation(JSON.parse(savedLocation));
      } catch (error) {
        console.error('Error parsing saved location:', error);
      }
    }
  }, []);

  // Load active and completed deliveries
  useEffect(() => {
    loadDeliveries();
  }, [volunteerLocation]);

  const loadDeliveries = () => {
    setIsLoading(true);
    
    // Get all donations from storage
    const allDonations = donationStorage.getAllDonations();
    
    // Filter for picked donations (active deliveries)
    const picked = allDonations.filter(d => d.status === 'picked');
    
    // Filter for ordered donations that need pickup
    const ordered = allDonations.filter(d => d.status === 'ordered');
    
    // Filter for delivered donations (completed deliveries)
    const delivered = allDonations.filter(d => d.status === 'delivered');
    
    // Combine picked and ordered donations as active deliveries
    const activeDeliveries = [...picked, ...ordered];
    
    // Calculate distances if volunteer location is available
    if (volunteerLocation) {
      const activeWithDistance = activeDeliveries.map(donation => ({
        ...donation,
        distance: LocationService.calculateDistance(
          volunteerLocation.lat,
          volunteerLocation.lng,
          donation.location.lat,
          donation.location.lng
        )
      }));
      
      const completedWithDistance = delivered.map(donation => ({
        ...donation,
        distance: LocationService.calculateDistance(
          volunteerLocation.lat,
          volunteerLocation.lng,
          donation.location.lat,
          donation.location.lng
        )
      }));
      
      setActiveDeliveries(activeWithDistance);
      setCompletedDeliveries(completedWithDistance);
    } else {
      setActiveDeliveries(activeDeliveries);
      setCompletedDeliveries(delivered);
    }
    
    setIsLoading(false);
  };

  const handleDeliverDonation = async (donation: Donation) => {
    setSelectedDelivery(donation);
    setDeliveryStatus('delivering');

    try {
      // Simulate delivery process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update donation status in storage
      donationStorage.updateDonation(donation.id, { status: 'delivered' });
      
      // Update local state
      setActiveDeliveries(prev => prev.filter(d => d.id !== donation.id));
      setCompletedDeliveries(prev => [donation, ...prev]);
      
      setDeliveryStatus('success');
      
      // Reset after 3 seconds
      setTimeout(() => {
        setDeliveryStatus('idle');
        setSelectedDelivery(null);
      }, 3000);
    } catch (error) {
      setDeliveryStatus('error');
      setTimeout(() => setDeliveryStatus('idle'), 3000);
    }
  };

  const getExpiryStatus = (expiry: Date) => {
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { status: 'expired', color: 'text-red-600', bg: 'bg-red-50' };
    if (diffDays <= 2) return { status: 'expiring_soon', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { status: 'fresh', color: 'text-green-600', bg: 'bg-green-50' };
  };

  const getDeliveryInstructions = (donation: Donation) => {
    // If this is an ordered donation, get the actual NGO order information
    if (donation.status === 'ordered') {
      try {
        const savedOrders = JSON.parse(localStorage.getItem('ngoOrders') || '[]');
        const order = savedOrders.find((order: any) => 
          order.items.some((item: any) => item.donationId === donation.id)
        );
        
        if (order) {
          return {
            recipientName: order.ngoName || 'NGO Organization',
            recipientPhone: '+1 (555) NGO-HELP', // In real app, this would be stored in order
            recipientEmail: 'contact@ngo.org', // In real app, this would be stored in order
            deliveryAddress: order.deliveryAddress || 'NGO Address',
            deliveryInstructions: 'Please deliver to the NGO location. Contact the organization upon arrival.',
            preferredDeliveryTime: '9:00 AM - 5:00 PM'
          };
        }
      } catch (error) {
        console.error('Error getting NGO order info:', error);
      }
    }
    
    // For picked donations (not ordered), use default delivery instructions
    return {
      recipientName: 'Community Food Bank',
      recipientPhone: '+1 (555) 123-4567',
      recipientEmail: 'contact@communityfoodbank.org',
      deliveryAddress: '123 Hope Street, Mississippi, MS 39201',
      deliveryInstructions: 'Please deliver to the back entrance. Ring the bell and someone will come to receive the donation.',
      preferredDeliveryTime: '9:00 AM - 5:00 PM'
    };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Deliveries</h1>
              <p className="text-gray-600">Track and manage your food delivery missions</p>
            </div>
            <div className="flex items-center space-x-2">
              <Truck className="w-6 h-6 text-blue-600" />
              <span className="text-sm text-gray-600">Delivery Hub</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Stats Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Delivery Stats</h2>
              
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <Truck className="w-6 h-6 text-blue-600" />
                    <div>
                      <h3 className="font-medium text-blue-900">Active Deliveries</h3>
                      <p className="text-2xl font-bold text-blue-700">{activeDeliveries.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div>
                      <h3 className="font-medium text-green-900">Completed</h3>
                      <p className="text-2xl font-bold text-green-700">{completedDeliveries.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <Route className="w-6 h-6 text-purple-600" />
                    <div>
                      <h3 className="font-medium text-purple-900">Total Distance</h3>
                      <p className="text-2xl font-bold text-purple-700">
                        {activeDeliveries.reduce((total, d) => total + d.distance, 0).toFixed(1)}km
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-6 space-y-3">
                <button
                  onClick={loadDeliveries}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <Loader2 className="w-4 h-4" />
                  <span>Refresh Deliveries</span>
                </button>
                
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm">
                    <strong>Tip:</strong> Make sure to deliver donations before they expire!
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Deliveries List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Active Deliveries</h2>
                {isLoading && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading deliveries...</span>
                  </div>
                )}
              </div>

              {activeDeliveries.length === 0 ? (
                <div className="text-center py-12">
                  <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Deliveries</h3>
                  <p className="text-gray-600">You don't have any deliveries to complete right now</p>
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-md mx-auto">
                    <p className="text-blue-800 text-sm">
                      <strong>Need deliveries?</strong> Go to Volunteer Hub and pick up some donations first!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {activeDeliveries.map((donation, index) => {
                    const expiryStatus = getExpiryStatus(donation.expiry);
                    const deliveryInfo = getDeliveryInstructions(donation);
                    
                    return (
                      <motion.div
                        key={donation.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-3">
                              <h3 className="text-lg font-semibold text-gray-900">{donation.foodType}</h3>
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${expiryStatus.bg} ${expiryStatus.color}`}>
                                {expiryStatus.status === 'expired' ? 'Expired' : 
                                 expiryStatus.status === 'expiring_soon' ? 'Expiring Soon' : 'Fresh'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Package className="w-4 h-4" />
                                <span>{donation.quantity} {donation.unit}</span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Users className="w-4 h-4" />
                                <span>From: {donation.donorName}</span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Calendar className="w-4 h-4" />
                                <span>Expires: {formatDate(donation.expiry)}</span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Clock className="w-4 h-4" />
                                <span>Picked: {formatDate(donation.updatedAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="ml-4">
                            <button
                              onClick={() => handleDeliverDonation(donation)}
                              disabled={deliveryStatus === 'delivering'}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
                            >
                              {deliveryStatus === 'delivering' && selectedDelivery?.id === donation.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Delivering...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  <span>Mark Delivered</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Delivery Information */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                          <h4 className="font-medium text-blue-900 mb-3 flex items-center space-x-2">
                            <Target className="w-4 h-4" />
                            <span>Delivery Information</span>
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium text-blue-800">Recipient:</p>
                              <p className="text-sm text-blue-700">{deliveryInfo.recipientName}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-blue-800">Delivery Address:</p>
                              <p className="text-sm text-blue-700">{deliveryInfo.deliveryAddress}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-blue-800">Contact:</p>
                              <div className="flex items-center space-x-2 text-sm text-blue-700">
                                <Phone className="w-3 h-3" />
                                <span>{deliveryInfo.recipientPhone}</span>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-blue-800">Preferred Time:</p>
                              <p className="text-sm text-blue-700">{deliveryInfo.preferredDeliveryTime}</p>
                            </div>
                          </div>
                          
                          <div className="mt-3">
                            <p className="text-sm font-medium text-blue-800">Instructions:</p>
                            <p className="text-sm text-blue-700">{deliveryInfo.deliveryInstructions}</p>
                          </div>
                        </div>

                        {/* Distance Information */}
                        {volunteerLocation && (
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center space-x-2">
                              <Navigation className="w-4 h-4" />
                              <span>{LocationService.formatDistance(donation.distance)} to delivery</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Clock className="w-4 h-4" />
                              <span>{LocationService.getEstimatedTravelTime(donation.distance)} travel time</span>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Completed Deliveries */}
            {completedDeliveries.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 mt-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Completed Deliveries</h2>
                <div className="space-y-4">
                  {completedDeliveries.slice(0, 5).map((donation, index) => (
                    <motion.div
                      key={donation.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <div>
                            <h3 className="font-medium text-gray-900">{donation.foodType}</h3>
                            <p className="text-sm text-gray-600">
                              Delivered on {formatDate(donation.updatedAt)}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {donation.quantity} {donation.unit}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Success/Error Messages */}
        {deliveryStatus === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed bottom-4 right-4 bg-green-600 text-white p-4 rounded-lg shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5" />
              <span>Successfully delivered donation!</span>
            </div>
          </motion.div>
        )}

        {deliveryStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed bottom-4 right-4 bg-red-600 text-white p-4 rounded-lg shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>Failed to mark as delivered. Please try again.</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
} 