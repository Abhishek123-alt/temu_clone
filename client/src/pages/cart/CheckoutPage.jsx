import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, MapPin, ShieldCheck, ArrowRight, Loader2, Gift, Trash2, AlertTriangle, X } from 'lucide-react';
import { toast } from '../../utils/toast';
import api from '../../services/api';

const EMPTY_ADDRESS = { name: '', street: '', city: '', state: '', zip: '', country: 'India', is_default: false };

const formatAddress = (addr) => {
  if (!addr) return '';
  const parts = [
    addr.name,
    addr.street,
    [addr.city, addr.state, addr.zip].filter(Boolean).join(', '),
    addr.country,
  ].filter(Boolean);
  return parts.join('\n');
};

const CheckoutPage = () => {
  const { items, clearCart, fetchCart } = useCartStore();
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const defaultSaved = user?.addresses?.find(a => a.is_default) || user?.addresses?.[0] || null;
  const [selectedAddressId, setSelectedAddressId] = useState(defaultSaved?.id || null);
  const [newAddress, setNewAddress] = useState({ ...EMPTY_ADDRESS, name: user?.full_name || '' });
  const [showNewAddressForm, setShowNewAddressForm] = useState(!defaultSaved);
  const [selectedReward, setSelectedReward] = useState(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(user?.payment_methods?.find(p => p.is_default) || user?.payment_methods?.[0] || null);
  const [showNewCardForm, setShowNewCardForm] = useState(false);
  const [newCard, setNewCard] = useState({ brand: 'Visa', last4: '', exp_month: '', exp_year: '', is_default: false });
  const [addingCard, setAddingCard] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState(null);

  // Track cart item IDs the user has *explicitly* unchecked. Derived selection
  // = (every cart item) minus (excluded) minus (out-of-stock). Excluding rather
  // than including avoids the need to sync state with the cart inside an effect.
  const [excludedItemIds, setExcludedItemIds] = useState(() => new Set());

  const confirmDeleteAddress = (e, addressId) => {
    e.stopPropagation();
    setAddressToDelete(addressId);
  };

  const handleSetDefault = async (e, addr) => {
    e.stopPropagation();
    try {
      await api.put(`/user/addresses/${addr.id}`, {
        name: addr.name || '',
        street: addr.street,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        country: addr.country,
        is_default: true,
      });
      const userRes = await api.get('/user/me');
      setUser(userRes.data);
      toast.success("Default address updated");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : "Failed to update default address");
    }
  };

  const handleDeleteAddress = async () => {
    if (!addressToDelete) return;
    try {
      await api.delete(`/user/addresses/${addressToDelete}`);
      const userRes = await api.get('/user/me');
      setUser(userRes.data);
      toast.success("Address removed");

      // If we deleted the currently selected address, clear selection
      if (selectedAddressId === addressToDelete) {
        const next = userRes.data.addresses?.find(a => a.is_default) || userRes.data.addresses?.[0] || null;
        setSelectedAddressId(next?.id || null);
        if (!next) setShowNewAddressForm(true);
      }
      setAddressToDelete(null);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : "Failed to remove address");
      setAddressToDelete(null);
    }
  };

  React.useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get('/user/me');
        setUser(res.data);
        if (!selectedPaymentMethod && res.data.payment_methods?.length > 0) {
          setSelectedPaymentMethod(res.data.payment_methods.find(p => p.is_default) || res.data.payment_methods[0]);
        }
        if (!selectedAddressId && res.data.addresses?.length > 0) {
          const next = res.data.addresses.find(a => a.is_default) || res.data.addresses[0];
          setSelectedAddressId(next.id);
          setShowNewAddressForm(false);
        }
        setNewAddress(prev => prev.name ? prev : { ...prev, name: res.data.full_name || '' });
      } catch (err) {
        console.error("Failed to refresh user data", err);
      }
    };
    fetchUser();
    // Refresh the cart so stock numbers are current before the user pays
    fetchCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (newCard.last4.length !== 4) return toast.error("Last 4 digits must be 4 digits");
    setAddingCard(true);
    try {
      const res = await api.post('/user/payment-methods', newCard);
      const userRes = await api.get('/user/me');
      setUser(userRes.data);
      setSelectedPaymentMethod(res.data);
      setShowNewCardForm(false);
      setNewCard({ brand: 'Visa', last4: '', exp_month: '', exp_year: '', is_default: false });
      toast.success("Card added!");
    } catch (err) {
      toast.error("Failed to add card");
    } finally {
      setAddingCard(false);
    }
  };

  const stockIssue = (item) => {
    const stock = item.product?.stock;
    if (typeof stock !== 'number') return null;
    if (stock <= 0) return { kind: 'out', stock };
    if (item.quantity > stock) return { kind: 'low', stock };
    return null;
  };
  const outOfStockItems = items.filter((item) => stockIssue(item));
  const isItemSelected = (item) => !stockIssue(item) && !excludedItemIds.has(item.id);
  const selectedItems = items.filter(isItemSelected);
  const unselectedInStockCount = items.filter(
    (item) => !stockIssue(item) && excludedItemIds.has(item.id),
  ).length;
  const isPartialOrder = selectedItems.length < items.length;

  const toggleItem = (item) => {
    if (stockIssue(item)) return; // OOS can't be selected
    setExcludedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const subtotal = selectedItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const shipping = selectedItems.length > 0 ? 9.99 : 0; // Flat shipping rate
  const tax = subtotal * 0.08;

  // Calculate Discount over the selected items only
  let discount = 0;
  if (selectedReward && selectedItems.length > 0) {
    // Robustly extract numeric value (handles "$10", "10%", "10 Credits", etc.)
    const numericValue = parseFloat(selectedReward.value.replace(/[^0-9.]/g, '')) || 0;

    if (selectedReward.reward_type === 'coupon') {
      discount = (subtotal * numericValue) / 100;
    } else if (selectedReward.reward_type === 'credit') {
      discount = numericValue;
    } else if (selectedReward.reward_type === 'freeship' || selectedReward.reward_type === 'freeship') {
      discount = shipping;
    } else if (selectedReward.reward_type === 'bogo') {
      const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
      if (totalQuantity >= 2) {
        const prices = selectedItems.map(item => item.product.price);
        discount = Math.min(...prices);
      } else {
        discount = 0;
      }
    } else if (selectedReward.reward_type === 'gift') {
      discount = Math.min(subtotal, 10);
    } else {
      discount = numericValue;
    }
  }

  // Platform fee must mirror the backend exactly (see services.create_order):
  //   pre_fee_total = max(0, subtotal + shipping + tax − discount)
  //   platform_fee  = round(0.30 + 0.02 × pre_fee_total, 2)
  //   total         = pre_fee_total + platform_fee
  // Frontend was previously skipping the fee and silently undercharging in the
  // UI while the server added it on top of what the customer saw.
  const preFeeTotal = Math.max(0, subtotal + shipping + tax - discount);
  const platformFee = selectedItems.length > 0
    ? Math.round((0.30 + 0.02 * preFeeTotal) * 100) / 100
    : 0;
  const total = Math.round((preFeeTotal + platformFee) * 100) / 100;

  const validateNewAddress = (addr) => {
    if (!addr.name.trim()) return "Please enter the recipient's name";
    if (!addr.street.trim()) return "Please enter your street address";
    if (!addr.city.trim()) return "Please enter your city";
    if (!addr.state.trim()) return "Please enter your state";
    if (!addr.zip.trim()) return "Please enter your zip code";
    if (!addr.country.trim()) return "Please enter your country";
    return null;
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      return toast.error("Select at least one item to place an order");
    }
    // Validate stock for the items the user is actually ordering
    const orderingIssue = selectedItems.find((item) => stockIssue(item));
    if (orderingIssue) {
      const issue = stockIssue(orderingIssue);
      return toast.error(
        issue.kind === 'out'
          ? `"${orderingIssue.product.title}" is out of stock. Unselect it to continue.`
          : `Only ${issue.stock} left of "${orderingIssue.product.title}". Reduce the quantity to continue.`
      );
    }
    if (!selectedPaymentMethod) return toast.error("Please select or add a payment method");

    // Resolve the shipping address (either selected saved or new)
    let shippingAddress;
    if (showNewAddressForm) {
      const err = validateNewAddress(newAddress);
      if (err) return toast.error(err);
      shippingAddress = newAddress;
    } else {
      shippingAddress = user?.addresses?.find(a => a.id === selectedAddressId);
      if (!shippingAddress) return toast.error("Please select a shipping address");
    }

    // Reward Validation — BOGO needs 2+ items in *this order*
    if (selectedReward?.reward_type === 'bogo') {
      const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
      if (totalQuantity < 2) {
        return toast.error("BOGO reward requires at least 2 selected items");
      }
    }

    setLoading(true);
    try {
      // If using a new address, persist it first (subject to the 3-address limit)
      if (showNewAddressForm && (user?.addresses?.length || 0) < 3) {
        try {
          await api.post('/user/addresses', newAddress);
          const userRes = await api.get('/user/me');
          setUser(userRes.data);
        } catch (err) {
          // Saving the address is best-effort; the order still goes through with the typed address.
          console.warn("Could not save new address to profile", err);
        }
      }

      navigate('/payment', {
        state: {
          amount: total,
          paymentMethod: selectedPaymentMethod,
          checkoutDetails: {
            shipping_address: formatAddress(shippingAddress),
            total_amount: total,
            reward_id: selectedReward ? selectedReward.id : undefined,
            payment_method_id: selectedPaymentMethod.type === 'upi' ? undefined : selectedPaymentMethod.id,
            // Only send the selection when it's a partial order; otherwise the
            // backend treats null as "order the whole cart".
            cart_item_ids: isPartialOrder ? selectedItems.map((it) => it.id) : undefined,
          }
        }
      });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Your cart is empty</h2>
        <button onClick={() => navigate('/')} className="mt-4 text-[#fb7701] font-bold">Continue Shopping</button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-10">
      <div className="max-w-5xl mx-auto px-4">
        <h1 className="text-3xl font-extrabold mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Order Items Review */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  Your Items <span className="text-sm font-normal text-gray-400">({selectedItems.length}/{items.length})</span>
                </h2>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Uncheck to keep in cart</p>
              </div>
              <div className="space-y-4">
                {items.map((item) => {
                  const issue = stockIssue(item);
                  const checked = isItemSelected(item);
                  return (
                  <div key={item.product.id} className={`flex items-center gap-4 pb-4 border-b border-gray-50 last:border-0 last:pb-0 ${!checked ? 'opacity-60' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!!issue}
                      onChange={() => toggleItem(item)}
                      className="w-5 h-5 rounded border-gray-300 text-[#fb7701] focus:ring-[#fb7701] disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                    <div className="w-16 h-16 bg-gray-50 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0">
                      <img
                        src={item.product.images?.[0]?.url || 'https://via.placeholder.com/150'}
                        alt={item.product.title}
                        className={`w-full h-full object-cover ${issue ? 'grayscale' : ''}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 text-sm truncate">{item.product.title}</h4>
                      <p className="text-xs text-gray-400 mt-1">Quantity: {item.quantity}</p>
                      {issue && (
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-wider mt-1 flex items-center gap-1">
                          <AlertTriangle size={11} />
                          {issue.kind === 'out' ? 'Out of stock' : `Only ${issue.stock} left`}
                        </p>
                      )}
                      {!issue && !checked && (
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mt-1">Stays in cart</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-black text-gray-900 text-sm">${(item.product.price * item.quantity).toFixed(2)}</p>
                      <p className="text-[10px] text-gray-400">${item.product.price} each</p>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-[#fb7701]">
                    <MapPin size={20} />
                  </div>
                  <h2 className="text-xl font-bold">Shipping Address</h2>
                </div>
                {user?.addresses && user.addresses.length > 0 && user.addresses.length < 3 && !showNewAddressForm && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewAddressForm(true);
                      setSelectedAddressId(null);
                      setNewAddress({ ...EMPTY_ADDRESS, name: user?.full_name || '' });
                    }}
                    className="text-xs font-bold text-[#fb7701] hover:underline"
                  >
                    + Use New Address
                  </button>
                )}
                {user?.addresses && user.addresses.length >= 3 && !showNewAddressForm && (
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full">
                    Max 3 Addresses Reached
                  </span>
                )}
                {showNewAddressForm && user?.addresses?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewAddressForm(false);
                      const next = user.addresses.find(a => a.is_default) || user.addresses[0];
                      setSelectedAddressId(next?.id || null);
                    }}
                    className="text-xs font-bold text-gray-400 hover:underline"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {user?.addresses?.length > 0 && !showNewAddressForm && (
                <div className="grid grid-cols-1 gap-3">
                  {user.addresses.map((addr) => (
                    <div
                      key={addr.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedAddressId(addr.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedAddressId(addr.id); }}
                      className={`text-left p-4 rounded-xl border-2 transition-all relative group cursor-pointer ${
                        selectedAddressId === addr.id
                          ? 'border-[#fb7701] bg-orange-50'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">{addr.name || user.full_name}</p>
                          <p className="text-xs text-gray-500 mt-1">{addr.street}</p>
                          <p className="text-[10px] text-gray-400">{addr.city}, {addr.state} {addr.zip}{addr.country ? ` · ${addr.country}` : ''}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {addr.is_default ? (
                            <span className="text-[9px] bg-green-50 text-green-600 px-2 py-1 rounded-full font-black uppercase tracking-wider">Default</span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleSetDefault(e, addr)}
                              className="text-[10px] font-bold text-gray-400 hover:text-[#fb7701] hover:underline"
                            >
                              Set as default
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => confirmDeleteAddress(e, addr.id)}
                            className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showNewAddressForm && (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newAddress.name}
                    onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                    placeholder="Recipient Name"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-[#fb7701] focus:border-[#fb7701]"
                  />
                  <input
                    type="text"
                    value={newAddress.street}
                    onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                    placeholder="Street Address"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-[#fb7701] focus:border-[#fb7701]"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      placeholder="City"
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-[#fb7701] focus:border-[#fb7701]"
                    />
                    <input
                      type="text"
                      value={newAddress.state}
                      onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                      placeholder="State"
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-[#fb7701] focus:border-[#fb7701]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={newAddress.zip}
                      onChange={(e) => setNewAddress({ ...newAddress, zip: e.target.value })}
                      placeholder="Zip Code"
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-[#fb7701] focus:border-[#fb7701]"
                    />
                    <input
                      type="text"
                      value={newAddress.country}
                      onChange={(e) => setNewAddress({ ...newAddress, country: e.target.value })}
                      placeholder="Country"
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-[#fb7701] focus:border-[#fb7701]"
                    />
                  </div>
                  {(user?.addresses?.length || 0) < 3 && (
                    <label className="flex items-center gap-3 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAddress.is_default}
                        onChange={(e) => setNewAddress({ ...newAddress, is_default: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-[#fb7701] focus:ring-[#fb7701]"
                      />
                      <span className="text-xs text-gray-500 font-bold">Save as default address</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                    <CreditCard size={20} />
                  </div>
                  <h2 className="text-xl font-bold">Payment Method</h2>
                </div>
                <button 
                  onClick={() => setShowNewCardForm(!showNewCardForm)}
                  className="text-xs font-bold text-[#fb7701] hover:underline"
                >
                  {showNewCardForm ? 'Cancel' : '+ Add New Card'}
                </button>
              </div>

              {showNewCardForm ? (
                <motion.form 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  onSubmit={handleAddCard}
                  className="space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-100"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <select 
                      className="col-span-full p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm"
                      value={newCard.brand}
                      onChange={(e) => setNewCard({...newCard, brand: e.target.value})}
                    >
                      <option>Visa</option>
                      <option>Mastercard</option>
                      <option>American Express</option>
                      <option>Discover</option>
                    </select>
                    <input 
                      type="text" 
                      placeholder="Last 4 digits"
                      maxLength="4"
                      className="p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm"
                      value={newCard.last4}
                      onChange={(e) => setNewCard({...newCard, last4: e.target.value.replace(/\D/g, '')})}
                      required
                    />
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="MM"
                        maxLength="2"
                        className="w-1/2 p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm text-center"
                        value={newCard.exp_month}
                        onChange={(e) => setNewCard({...newCard, exp_month: e.target.value.replace(/\D/g, '')})}
                        required
                      />
                      <input 
                        type="text" 
                        placeholder="YYYY"
                        maxLength="4"
                        className="w-1/2 p-3 bg-white border border-gray-200 rounded-xl font-bold text-sm text-center"
                        value={newCard.exp_year}
                        onChange={(e) => setNewCard({...newCard, exp_year: e.target.value.replace(/\D/g, '')})}
                        required
                      />
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={addingCard}
                    className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-black transition-all flex items-center justify-center gap-2"
                  >
                    {addingCard ? <Loader2 className="animate-spin" size={16} /> : 'Save and Use Card'}
                  </button>
                </motion.form>
              ) : (
                <div className="space-y-3">
                  {user?.payment_methods?.length > 0 ? (
                    user.payment_methods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setSelectedPaymentMethod(method)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                          selectedPaymentMethod?.id === method.id 
                            ? 'border-[#fb7701] bg-orange-50' 
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-6 bg-white rounded border flex items-center justify-center text-[8px] font-black uppercase">
                            {method.brand}
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-sm">•••• {method.last4}</p>
                            <p className="text-[10px] text-gray-400 font-medium">Expires {method.exp_month}/{method.exp_year}</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedPaymentMethod?.id === method.id ? 'border-[#fb7701]' : 'border-gray-200'
                        }`}>
                          {selectedPaymentMethod?.id === method.id && <div className="w-2.5 h-2.5 bg-[#fb7701] rounded-full" />}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <p className="text-sm text-gray-400 font-medium mb-3">
                        {user?.payment_methods?.length >= 3 ? "Max 3 cards reached" : "No cards saved"}
                      </p>
                      {user?.payment_methods?.length < 3 && (
                        <button 
                          onClick={() => setShowNewCardForm(true)}
                          className="text-[#fb7701] font-bold text-sm hover:underline"
                        >
                          + Add a credit or debit card
                        </button>
                      )}
                    </div>
                  )}

                  {user?.payment_methods && user.payment_methods.length > 0 && user.payment_methods.length < 3 && !showNewCardForm && (
                    <button 
                      onClick={() => setShowNewCardForm(true)}
                      className="w-full py-3 border-2 border-dashed border-gray-100 rounded-xl text-gray-400 font-bold text-sm hover:border-gray-200 hover:text-gray-500 transition-all mt-2"
                    >
                      + Use another card
                    </button>
                  )}

                  {/* Other Payment Methods Option */}
                  <div className="pt-4 border-t border-gray-50">
                    <button
                      onClick={() => setSelectedPaymentMethod({ type: 'upi' })}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                        selectedPaymentMethod?.type === 'upi'
                          ? 'border-[#fb7701] bg-orange-50'
                          : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-6 bg-white rounded border flex items-center justify-center text-[8px] font-black uppercase text-[#fb7701]">
                          UPI
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm">Pay via UPI</p>
                          <p className="text-[10px] text-gray-400 font-medium">GPay, PhonePe, and more</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedPaymentMethod?.type === 'upi' ? 'border-[#fb7701]' : 'border-gray-200'
                      }`}>
                        {selectedPaymentMethod?.type === 'upi' && <div className="w-2.5 h-2.5 bg-[#fb7701] rounded-full" />}
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-4 text-xs text-gray-500 flex items-center gap-1">
                <ShieldCheck size={14} className="text-green-500" />
                Your payment information is encrypted and secure.
              </p>
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-2 space-y-6 sticky top-24">
          {/* Rewards & Coupons Selection */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Gift size={20} className="text-[#fb7701]" /> Coupons & Offers
            </h3>
            
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {user?.rewards?.filter(r => !r.is_used).length > 0 ? (
                user.rewards.filter(r => !r.is_used).map((reward) => (
                  <button
                    key={reward.id}
                    onClick={() => setSelectedReward(selectedReward?.id === reward.id ? null : reward)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                      selectedReward?.id === reward.id 
                        ? 'border-[#fb7701] bg-orange-50' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-black text-[#fb7701] uppercase tracking-wider">{reward.reward_type}</p>
                        <p className="font-bold text-gray-900">{reward.value}</p>
                        {reward.reward_type === 'bogo' && items.reduce((s, i) => s + i.quantity, 0) < 2 && (
                          <p className="text-[10px] text-red-500 font-bold mt-1">Add 1 more item to use</p>
                        )}
                        <p className="text-[10px] font-mono text-gray-400 mt-1">{reward.code}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedReward?.id === reward.id ? 'border-[#fb7701]' : 'border-gray-200'
                      }`}>
                        {selectedReward?.id === reward.id && <div className="w-2.5 h-2.5 bg-[#fb7701] rounded-full" />}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">No coupons available. Go spin the wheel!</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Order Summary</h2>
            <div className="space-y-4 text-gray-600 font-medium">
              <div className="flex justify-between">
                <span>Subtotal ({selectedItems.length} item{selectedItems.length === 1 ? '' : 's'})</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="text-green-600 font-bold">{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Tax</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600 font-bold">
                  <span>Discount</span>
                  <span>-${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between" title="Flat $0.30 + 2% transaction fee — covers payment processing">
                <span>Platform Fee</span>
                <span>${platformFee.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xl font-bold text-gray-900">Order Total</span>
                <span className="text-3xl font-black text-[#fb7701]">${total.toFixed(2)}</span>
              </div>
            </div>
              {outOfStockItems.length > 0 && (
                <div className="mt-6 bg-amber-50 border border-amber-100 p-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800 font-bold">
                    {outOfStockItems.length} unavailable item{outOfStockItems.length === 1 ? '' : 's'} will stay in your cart and won&apos;t be charged.
                  </p>
                </div>
              )}
              {unselectedInStockCount > 0 && (
                <div className="mt-3 bg-orange-50 border border-orange-100 p-3 rounded-lg flex items-start gap-2">
                  <Gift size={16} className="text-[#fb7701] mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-orange-800 font-bold">
                    {unselectedInStockCount} item{unselectedInStockCount === 1 ? '' : 's'} unchecked &mdash; they&apos;ll stay in your cart for later.
                  </p>
                </div>
              )}
              <button
                onClick={handlePlaceOrder}
                disabled={loading || selectedItems.length === 0}
                className="w-full mt-6 bg-[#fb7701] text-white py-4 rounded-full font-bold text-lg hover:bg-[#e06a01] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    {isPartialOrder ? `Place Partial Order (${selectedItems.length})` : 'Place Order'} <ArrowRight size={20} />
                  </>
                )}
              </button>

              <div className="mt-6 space-y-4">
                <div className="bg-green-50 p-3 rounded-lg flex items-start gap-3">
                  <ShieldCheck size={18} className="text-green-600 mt-0.5" />
                  <p className="text-[10px] text-green-800">
                    <strong>Temu Purchase Protection</strong><br/>
                    Shop with confidence. Your order is protected from checkout to delivery.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rich Delete Confirmation Modal for Address */}
      <AnimatePresence>
        {addressToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAddressToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-sm p-10 relative z-10 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 text-[#fb7701]">
                <AlertTriangle size={40} />
              </div>
              <h2 className="text-2xl font-black mb-4">Remove Address?</h2>
              <p className="text-gray-500 mb-8 font-medium">This shipping address will be permanently removed from your profile.</p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDeleteAddress}
                  className="w-full bg-[#fb7701] text-white py-4 rounded-full font-bold hover:bg-[#e06a01] transition-all shadow-lg shadow-orange-100"
                >
                  Yes, Remove Address
                </button>
                <button
                  onClick={() => setAddressToDelete(null)}
                  className="w-full bg-gray-50 text-gray-500 py-4 rounded-full font-bold hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CheckoutPage;
