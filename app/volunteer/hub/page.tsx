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
  Heart,
  Calendar,
  Search,
  ShoppingCart
} from 'lucide-react';
import { Donation } from '@/app/types';
import { LocationService, Location, LocationWithDistance } from '@/app/lib/location-service';
import { formatDate } from '@/app/lib/utils';
import { donationStorage } from '@/app/lib/donation-storage';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function VolunteerHub() {
  const [volunteerLocation, setVolunteerLocation] = useState<Location | undefined>(undefined);
  const [nearbyDonations, setNearbyDonations] = useState<(Donation & { distance: number })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [pickupStatus, setPickupStatus] = useState<'idle' | 'picking' | 'success' | 'error'>('idle');
  const [addressInput, setAddressInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLocation, setFilterLocation] = useState('');

  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated || !user) {
        router.push('/auth/signin');
        return;
      }
      if (user.role !== 'volunteer') {
        router.push('/');
        return;
      }
    }
  }, [isAuthenticated, user, loading, router]);

  // Note: Removed periodic refresh to prevent donations from disappearing
  // The donations will be loaded when location changes and when pickup status changes

  // Find nearby donations when volunteer location changes
  useEffect(() => {
    if (volunteerLocation) {
      setIsLoading(true);
      
      // Get all available donations (not just nearby ones)
      setTimeout(() => {
        const allDonations = donationStorage.getAllDonations();
        const pendingDonations = allDonations.filter(d => d.status === 'pending');
        const orderedDonations = allDonations.filter(d => d.status === 'ordered');
        
        // Calculate distances for all donations
        const pendingWithDistance = pendingDonations.map(d => ({
          ...d,
          distance: LocationService.calculateDistance(
            volunteerLocation.lat,
            volunteerLocation.lng,
            d.location.lat,
            d.location.lng
          )
        }));
        
        const orderedWithDistance = orderedDonations.map(d => ({
          ...d,
          distance: LocationService.calculateDistance(
            volunteerLocation.lat,
            volunteerLocation.lng,
            d.location.lat,
            d.location.lng
          )
        }));
        
        // Combine all available donations
        const allAvailable = [...pendingWithDistance, ...orderedWithDistance];

        setNearbyDonations(allAvailable);
        setIsLoading(false);
      }, 500);
    }
  }, [volunteerLocation]);

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddressInput(e.target.value);
    setError(null);
  };

  const handleGeocode = async () => {
    if (!addressInput.trim()) {
      setError('Please enter an address');
      return;
    }

    setIsGeocoding(true);
    setError(null);

    try {
      // For testing purposes, if user types "mississippi" or similar, use the test coordinates
      const lowerAddress = addressInput.toLowerCase();
      let location: Location;

      if (lowerAddress.includes('mississippi') || lowerAddress.includes('ms')) {
        location = {
          lat: 33.1581,
          lng: -89.7452,
          address: 'Mississippi, USA',
          city: 'Mississippi',
          state: 'MS',
          country: 'USA'
        };
      } else {
        // Use the location service for other addresses
        location = await LocationService.geocodeAddress(addressInput);
      }

      setVolunteerLocation(location);
      setAddressInput(location.address);
      
      // Save volunteer location to localStorage for delivery tracking
      localStorage.setItem('volunteerLocation', JSON.stringify(location));
    } catch (err) {
      setError('Failed to geocode address. Please try again.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsGeocoding(true);
      setError(null);
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const location: Location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              address: 'Current Location',
              city: 'Current Location',
              state: 'Current Location',
              country: 'Current Location'
            };
            setVolunteerLocation(location);
            setAddressInput('Current Location');
            
            // Save volunteer location to localStorage for delivery tracking
            localStorage.setItem('volunteerLocation', JSON.stringify(location));
          } catch (err) {
            setError('Failed to get current location');
          } finally {
            setIsGeocoding(false);
          }
        },
        (err) => {
          setError('Unable to get current location. Please enter address manually.');
          setIsGeocoding(false);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser');
    }
  };

  const handlePickupDonation = async (donation: Donation) => {
    setSelectedDonation(donation);
    setPickupStatus('picking');

    try {
      // Simulate pickup process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update donation status in storage
      donationStorage.updateDonation(donation.id, { status: 'picked' });
      
      // Update local state
      setNearbyDonations(prev => 
        prev.map(d => 
          d.id === donation.id 
            ? { ...d, status: 'picked' as any }
            : d
        )
      );
      
      setPickupStatus('success');
      
      // Reset after 3 seconds
      setTimeout(() => {
        setPickupStatus('idle');
        setSelectedDonation(null);
      }, 3000);
    } catch (error) {
      setPickupStatus('error');
      setTimeout(() => setPickupStatus('idle'), 3000);
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

  const refreshDonations = () => {
    if (volunteerLocation) {
      setIsLoading(true);
      
      // Get all available donations (not just nearby ones)
      setTimeout(() => {
        const allDonations = donationStorage.getAllDonations();
        const pendingDonations = allDonations.filter(d => d.status === 'pending');
        const orderedDonations = allDonations.filter(d => d.status === 'ordered');
        
        // Calculate distances for all donations
        const pendingWithDistance = pendingDonations.map(d => ({
          ...d,
          distance: LocationService.calculateDistance(
            volunteerLocation.lat,
            volunteerLocation.lng,
            d.location.lat,
            d.location.lng
          )
        }));
        
        const orderedWithDistance = orderedDonations.map(d => ({
          ...d,
          distance: LocationService.calculateDistance(
            volunteerLocation.lat,
            volunteerLocation.lng,
            d.location.lat,
            d.location.lng
          )
        }));
        
        // Combine all available donations
        const allAvailable = [...pendingWithDistance, ...orderedWithDistance];

        setNearbyDonations(allAvailable);
        setIsLoading(false);
      }, 500);
    }
  };

  // Filter donations based on search term and location
  const filteredDonations = nearbyDonations.filter(donation => {
    const matchesSearch = donation.foodType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         donation.donorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = !filterLocation || 
                           donation.location.address.toLowerCase().includes(filterLocation.toLowerCase()) ||
                           donation.location.city.toLowerCase().includes(filterLocation.toLowerCase());
    return matchesSearch && matchesLocation;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Volunteer Hub</h1>
              <p className="text-gray-600">Find and pick up food donations in your area</p>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/volunteer/deliveries"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Truck className="w-4 h-4" />
                <span>My Deliveries</span>
              </Link>
              <div className="flex items-center space-x-2">
                <Truck className="w-6 h-6 text-green-600" />
                <span className="text-sm text-gray-600">Ready to help!</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Location Setup */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Location</h2>
              
              {/* Address Input */}
              <div className="space-y-4">
                <div className="relative">
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="text"
                        value={addressInput}
                        onChange={handleAddressChange}
                        placeholder="Enter your address..."
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      onClick={handleGeocode}
                      disabled={isGeocoding || !addressInput.trim()}
                      className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                      {isGeocoding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      <span>Find</span>
                    </button>
                  </div>

                  {/* Current Location Button */}
                  <button
                    onClick={handleUseCurrentLocation}
                    disabled={isGeocoding}
                    className="mt-2 text-sm text-green-600 hover:text-green-700 flex items-center space-x-1 disabled:opacity-50"
                  >
                    <Navigation className="w-4 h-4" />
                    <span>Use Current Location</span>
                  </button>
                </div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center space-x-2 text-red-600 text-sm"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* Location Found Display */}
                {volunteerLocation && !error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-50 border border-green-200 rounded-lg p-4"
                  >
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-green-900">Location Found</h4>
                        <p className="text-green-700 text-sm">{volunteerLocation.address}</p>
                        <div className="mt-2 flex items-center space-x-4 text-xs text-green-600">
                          <span>Lat: {volunteerLocation.lat.toFixed(4)}</span>
                          <span>Lng: {volunteerLocation.lng.toFixed(4)}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Location Set Display */}
                {volunteerLocation && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-50 border border-green-200 rounded-lg p-4"
                  >
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-green-900">Location Set</h4>
                        <p className="text-green-700 text-sm">{volunteerLocation.address}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                                 {/* Stats */}
                 {volunteerLocation && (
                   <div className="mt-6 space-y-3">
                     <div className="flex items-center justify-between text-sm">
                       <span className="text-gray-600">Total Available:</span>
                       <span className="font-medium">{nearbyDonations.length}</span>
                     </div>
                     {(searchTerm || filterLocation) && (
                       <div className="flex items-center justify-between text-sm">
                         <span className="text-gray-600">Filtered Results:</span>
                         <span className="font-medium">{filteredDonations.length}</span>
                       </div>
                     )}
                     <div className="flex items-center justify-between text-sm">
                       <span className="text-gray-600">Showing:</span>
                       <span className="font-medium">
                         {(searchTerm || filterLocation) ? 'Filtered' : 'All Locations'}
                       </span>
                     </div>
                   </div>
                 )}

                                 {/* Search & Filter */}
                 {volunteerLocation && (
                   <div className="space-y-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">Search Donations</label>
                       <input
                         type="text"
                         value={searchTerm}
                         onChange={(e) => setSearchTerm(e.target.value)}
                         placeholder="Search food or donor..."
                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                       />
                     </div>

                     <div>
                       <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Location</label>
                       <input
                         type="text"
                         value={filterLocation}
                         onChange={(e) => setFilterLocation(e.target.value)}
                         placeholder="Enter city or address..."
                         className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                       />
                     </div>

                     {(searchTerm || filterLocation) && (
                       <div className="flex items-center justify-between text-sm">
                         <span className="text-gray-600">Filtered Results:</span>
                         <span className="font-medium">{filteredDonations.length}</span>
                       </div>
                     )}
                   </div>
                 )}

                 {/* Quick Test Instructions */}
                 <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                   <p className="text-blue-800 text-sm">
                     <strong>Quick Test:</strong> Type "Mississippi" and click Find to see test donations!
                   </p>
                 </div>
              </div>
            </div>
          </div>

          {/* Donations List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6">
                             <div className="flex items-center justify-between mb-6">
                 <h2 className="text-xl font-semibold text-gray-900">Available Donations</h2>
                 <div className="flex items-center space-x-2">
                   {isLoading && (
                     <div className="flex items-center space-x-2 text-sm text-gray-600">
                       <Loader2 className="w-4 h-4 animate-spin" />
                       <span>Loading donations...</span>
                     </div>
                   )}
                   {volunteerLocation && (
                     <button
                       onClick={refreshDonations}
                       disabled={isLoading}
                       className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-1"
                     >
                       <Loader2 className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                       <span>Refresh</span>
                     </button>
                   )}
                 </div>
               </div>
              
                             {/* Info Message */}
               {volunteerLocation && filteredDonations.length > 0 && (
                 <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                   <p className="text-blue-800 text-sm">
                     <strong>
                       {(searchTerm || filterLocation) 
                         ? `Showing ${filteredDonations.length} filtered donations` 
                         : 'Showing all available donations'
                       }
                     </strong> - Distance is calculated from your location to help you plan your pickup route.
                   </p>
                 </div>
               )}

               {!volunteerLocation ? (
                 <div className="text-center py-12">
                   <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                   <h3 className="text-lg font-medium text-gray-900 mb-2">Set Your Location</h3>
                   <p className="text-gray-600">Enter your address to find nearby food donations</p>
                   <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md mx-auto">
                     <p className="text-yellow-800 text-sm">
                       <strong>Tip:</strong> Type "Mississippi" in the location field to see test donations!
                     </p>
                   </div>
                 </div>
               ) : nearbyDonations.length === 0 ? (
                 <div className="text-center py-12">
                   <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                   <h3 className="text-lg font-medium text-gray-900 mb-2">No Donations Available</h3>
                   <p className="text-gray-600">No food donations are currently available for pickup</p>
                   <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg max-w-md mx-auto">
                     <p className="text-blue-800 text-sm">
                       <strong>Need test data?</strong> Go to Test Donations page and add some test donations first!
                     </p>
                   </div>
                 </div>
               ) : filteredDonations.length === 0 && (searchTerm || filterLocation) ? (
                 <div className="text-center py-12">
                   <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                   <h3 className="text-lg font-medium text-gray-900 mb-2">No Matching Donations</h3>
                   <p className="text-gray-600">No donations match your search criteria</p>
                   <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md mx-auto">
                     <p className="text-yellow-800 text-sm">
                       <strong>Try:</strong> Clear your search filters or try different keywords!
                     </p>
                   </div>
                 </div>
               ) : (
                 <div className="space-y-4">
                   {filteredDonations.map((donation, index) => {
                    const expiryStatus = getExpiryStatus(donation.expiry);
                    return (
                      <motion.div
                        key={donation.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
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
                                <span>{donation.donorName}</span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Calendar className="w-4 h-4" />
                                <span>Expires: {formatDate(donation.expiry)}</span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Clock className="w-4 h-4" />
                                <span>Created: {formatDate(donation.createdAt)}</span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-4 mb-4">
                              <div className="flex items-center space-x-2 text-sm text-blue-600">
                                <Navigation className="w-4 h-4" />
                                <span>{LocationService.formatDistance(donation.distance)} away</span>
                              </div>
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Clock className="w-4 h-4" />
                                <span>{LocationService.getEstimatedTravelTime(donation.distance)} travel time</span>
                              </div>
                            </div>

                            {donation.description && (
                              <p className="text-sm text-gray-600 mb-4">{donation.description}</p>
                            )}

                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              <MapPin className="w-4 h-4" />
                              <span>{donation.location.address}</span>
                            </div>
                          </div>

                          <div className="ml-4">
                            <button
                              onClick={() => handlePickupDonation(donation)}
                              disabled={donation.status !== 'pending' && donation.status !== 'ordered' || pickupStatus === 'picking'}
                              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 ${
                                donation.status === 'pending' || donation.status === 'ordered'
                                  ? donation.status === 'ordered' 
                                    ? 'bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50'
                                    : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              {pickupStatus === 'picking' && selectedDonation?.id === donation.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Picking...</span>
                                </>
                              ) : donation.status === 'pending' ? (
                                <>
                                  <Truck className="w-4 h-4" />
                                  <span>Pick Up</span>
                                </>
                              ) : donation.status === 'ordered' ? (
                                <>
                                  <ShoppingCart className="w-4 h-4" />
                                  <span>Pick Up Order</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  <span>Picked</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {pickupStatus === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed bottom-4 right-4 bg-green-600 text-white p-4 rounded-lg shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5" />
              <span>Successfully picked up donation!</span>
            </div>
          </motion.div>
        )}

        {pickupStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed bottom-4 right-4 bg-red-600 text-white p-4 rounded-lg shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>Failed to pick up donation. Please try again.</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
} 