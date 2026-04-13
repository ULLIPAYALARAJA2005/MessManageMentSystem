import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { socket } from '../socket';

const StoreManagerDashboard = () => {
    const [inventory, setInventory] = useState([]);
    const [newItemName, setNewItemName] = useState('');
    const [newItemQuantity, setNewItemQuantity] = useState('');
    const [reqItem, setReqItem] = useState('');
    const [reqAmount, setReqAmount] = useState('');

    useEffect(() => {
        fetchInventory();

        socket.on('inventoryUpdated', () => { fetchInventory(); });
        socket.on('stockRequested', () => { fetchInventory(); }); // If somehow needed

        return () => {
            socket.off('inventoryUpdated');
            socket.off('stockRequested');
        };
    }, []);

    const fetchInventory = async () => {
        try {
            const { data } = await api.get('/store/inventory');
            setInventory(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdateInventory = async (e) => {
        e.preventDefault();
        try {
            await api.post('/store/inventory', { name: newItemName, quantity: newItemQuantity });
            toast.success('Inventory updated');
            setNewItemName(''); setNewItemQuantity('');
            fetchInventory();
        } catch (err) {
            toast.error('Failed to update inventory');
        }
    };

    const handleMakeRequest = async (e) => {
        e.preventDefault();
        try {
            await api.post('/store/requests', { itemName: reqItem, amount: reqAmount });
            toast.success('Request submitted to Admin');
            setReqItem(''); setReqAmount('');
        } catch (err) {
            toast.error('Failed to submit request');
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h2 style={{ color: 'var(--primary-color)', marginBottom: '20px' }}>Store Manager Dashboard</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: 'var(--border-radius)' }}>
                    <h3>Current Inventory</h3>
                    <div style={{ marginTop: '15px' }}>
                        {inventory.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No items in inventory.</p> : null}
                        {inventory.map(item => (
                            <div key={item._id} style={{ display: 'flex', justifyContent: 'space-between', background: '#2d2d2d', padding: '10px 15px', borderRadius: '8px', marginBottom: '8px' }}>
                                <span>{item.name}</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>{item.quantity}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: 'var(--border-radius)', marginBottom: '20px' }}>
                        <h3>Update/Add Stock</h3>
                        <form onSubmit={handleUpdateInventory} style={{ marginTop: '15px' }}>
                            <div className="form-group">
                                <label>Item Name</label>
                                <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Quantity</label>
                                <input type="text" placeholder="e.g. 50 kg" value={newItemQuantity} onChange={e => setNewItemQuantity(e.target.value)} required />
                            </div>
                            <button className="btn-primary" type="submit">Update Item</button>
                        </form>
                    </div>

                    <div style={{ background: 'var(--surface-color)', padding: '20px', borderRadius: 'var(--border-radius)' }}>
                        <h3>Request New Items</h3>
                        <form onSubmit={handleMakeRequest} style={{ marginTop: '15px' }}>
                            <div className="form-group">
                                <label>Item Name</label>
                                <input type="text" value={reqItem} onChange={e => setReqItem(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Requested Amount</label>
                                <input type="text" placeholder="e.g. 10 liters" value={reqAmount} onChange={e => setReqAmount(e.target.value)} required />
                            </div>
                            <button className="btn-primary" type="submit" style={{ background: 'var(--success-color)' }}>Send Request To Admin</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoreManagerDashboard;
