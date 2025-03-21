import React, { useState, useEffect } from 'react';
import { Pencil, Save, Loader2, X, KeyRound, Shield, Camera } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import authUtils from '../utils/authUtils';

const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    
    // Trường hợp 1: Nếu là URL đầy đủ hoặc base64
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) {
        return imagePath;
    }
    
    // Trường hợp 2: Nếu là đường dẫn dạng DSNV_Images/...
    if (imagePath.startsWith('DSNV_Images/')) {
        const appName = encodeURIComponent('Quảnlýquáncafe-668554821');
        const tableName = encodeURIComponent('DSNV');
        const fileName = encodeURIComponent(imagePath);
        return `https://www.appsheet.com/template/gettablefileurl?appName=${appName}&tableName=${tableName}&fileName=${fileName}`;
    }
    
    // Nếu là dạng khác, trả về đường dẫn gốc
    return imagePath;
};

const Profile = () => {
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [changePassword, setChangePassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); 
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [userData, setUserData] = useState(null);
    const [imageFile, setImageFile] = useState(null);
    const [formData, setFormData] = useState({
        'Họ và Tên': '',
        'Chức vụ': '',
        'Phòng': '',
        'Email': '',
        'Image': '',
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const localUser = authUtils.getUserData();
                if (!localUser || !localUser.username) {
                    toast.error('Phiên đăng nhập đã hết hạn');
                    return;
                }
                
                const response = await authUtils.apiRequest('DSNV', 'Find', {
                    Properties: {
                        Selector: `Filter(DSNV, [username] = "${localUser.username}")`
                    }
                });
                
                const user = response[0];
                if (!user) {
                    throw new Error('Không tìm thấy thông tin người dùng');
                }

                setUserData(user);
                setFormData({
                    'Họ và Tên': user['Họ và Tên'] || '',
                    'Chức vụ': user['Chức vụ'] || '',
                    'Phòng': user['Phòng'] || '',
                    'Email': user['Email'] || '',
                    'Image': user['Image'] || '',
                });
            } catch (error) {
                console.error('Error fetching user data:', error);
                toast.error('Không thể tải thông tin người dùng');
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);
    
    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Validate file size
        if (file.size > 5000000) {
            toast.error('Kích thước ảnh không được vượt quá 5MB');
            return;
        }
        
        try {
            // Store the file for later upload
            setImageFile(file);
            
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({
                    ...prev,
                    'Image': reader.result // This is just for preview
                }));
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error handling image:', error);
            toast.error('Không thể đọc file ảnh');
        }
    };
    
    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handlePasswordChange = (e) => {
        setPasswordData({
            ...passwordData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;

        try {
            setIsSubmitting(true);
            
            // Handle image upload if there's a new image
            let imageUrl = formData['Image'];
            if (imageFile) {
                try {
                    toast.info('Đang tải ảnh lên...', { autoClose: false, toastId: 'uploadingImage' });
                    const uploadResult = await authUtils.uploadImage(imageFile);
                    if (uploadResult.success) {
                        imageUrl = uploadResult.url;
                    }
                    toast.dismiss('uploadingImage');
                } catch (error) {
                    console.error('Image upload error:', error);
                    toast.dismiss('uploadingImage');
                    toast.error('Không thể tải ảnh lên, nhưng vẫn tiếp tục lưu thông tin khác');
                }
            }
            
            const updatedData = {
                ...userData,
                ...formData,
                'Image': imageUrl
            };
            
            await authUtils.apiRequest('DSNV', 'Edit', {
                Rows: [updatedData]
            });

            authUtils.saveAuthData(updatedData);

            toast.success('Cập nhật thông tin thành công');
            setEditing(false);
            setImageFile(null);
            
            // Update userData to reflect changes
            setUserData(updatedData);
        } catch (error) {
            console.error('Update profile error:', error);
            toast.error('Cập nhật thông tin thất bại');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePasswordSubmit = async () => {
        if (isChangingPassword) return;
        
        // Validation
        if (!passwordData.currentPassword) {
            toast.error('Vui lòng nhập mật khẩu hiện tại');
            return;
        }
        
        if (!passwordData.newPassword) {
            toast.error('Vui lòng nhập mật khẩu mới');
            return;
        }

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('Mật khẩu mới không khớp');
            return;
        }
        
        // Verify current password
        if (passwordData.currentPassword !== userData.password) {
            toast.error('Mật khẩu hiện tại không đúng');
            return;
        }

        try {
            setIsChangingPassword(true);
            
            const updatedUser = {
                ...userData,
                password: passwordData.newPassword
            };
            
            await authUtils.apiRequest('DSNV', 'Edit', {
                Rows: [updatedUser]
            });
            
            // Update local storage
            authUtils.saveAuthData(updatedUser);
            
            // Update state
            setUserData(updatedUser);

            toast.success('Đổi mật khẩu thành công');
            setChangePassword(false);
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
        } catch (error) {
            console.error('Password change error:', error);
            toast.error('Đổi mật khẩu thất bại');
        } finally {
            setIsChangingPassword(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-screen">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
                    <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-blue-300 rounded-full animate-pulse"></div>
                </div>
                <p className="mt-4 text-gray-600 font-medium">Đang tải thông tin...</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm">
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Profile Sidebar */}
                        <div className="md:col-span-1">
                            <div className="flex flex-col items-center">
                                <div className="relative group">
                                    {formData['Image'] ? (
                                        <img 
                                            src={formData['Image'] instanceof File ? URL.createObjectURL(formData['Image']) : getImageUrl(formData['Image'])}
                                            alt="Profile" 
                                            className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-md"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                // Render a fallback avatar with initials
                                                const parent = e.target.parentNode;
                                                const initials = formData['Họ và Tên']?.[0]?.toUpperCase() || userData?.username?.[0]?.toUpperCase() || '?';
                                                const fallback = document.createElement('div');
                                                fallback.className = "w-32 h-32 rounded-full bg-blue-500 flex items-center justify-center text-white text-4xl font-semibold border-4 border-white shadow-md";
                                                fallback.innerText = initials;
                                                if (parent) parent.replaceChild(fallback, e.target);
                                            }}
                                        />
                                    ) : (
                                        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-4xl font-semibold border-4 border-white shadow-md">
                                            {formData['Họ và Tên']?.[0]?.toUpperCase() || userData?.username?.[0]?.toUpperCase() || '?'}
                                        </div>
                                    )}
                                    {editing && (
                                        <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleImageChange}
                                                disabled={isSubmitting}
                                            />
                                            <Camera className="h-8 w-8 text-white" />
                                        </label>
                                    )}
                                </div>
                                <h3 className="mt-6 text-xl font-semibold text-gray-800">
                                    {formData['Họ và Tên'] || userData?.username}
                                </h3>
                                <p className="text-gray-500 mt-1">
                                    {formData['Chức vụ']}
                                </p>
                                
                                <div className="mt-4 flex gap-2">
                                    <button
                                        onClick={() => setChangePassword(true)}
                                        disabled={isSubmitting}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <KeyRound className="w-4 h-4 mr-2" />
                                        Đổi mật khẩu
                                    </button>
                                </div>
                                
                                {userData?.['Phân quyền'] === 'Admin' && (
                                    <div className="mt-4 flex items-center bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">
                                        <Shield className="w-4 h-4 mr-1.5" />
                                        <span className="text-sm font-medium">Quản trị viên</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Profile Content */}
                        <div className="md:col-span-3">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-xl font-semibold text-gray-800">
                                    Thông tin cá nhân
                                </h2>
                                <button
                                    onClick={() => editing ? handleSubmit() : setEditing(true)}
                                    disabled={isSubmitting}
                                    className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${editing
                                            ? 'bg-green-500 hover:bg-green-600 text-white'
                                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                                        } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {editing ? (
                                        <>
                                            {isSubmitting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                                    Đang lưu...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4 mr-2" />
                                                    Lưu
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <Pencil className="w-4 h-4 mr-2" />
                                            Chỉnh sửa
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Họ và tên
                                    </label>
                                    <input
                                        type="text"
                                        name="Họ và Tên"
                                        value={formData['Họ và Tên']}
                                        onChange={handleInputChange}
                                        disabled={!editing || isSubmitting}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-gray-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        name="Email"
                                        value={formData['Email']}
                                        onChange={handleInputChange}
                                        disabled={!editing || isSubmitting}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-gray-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Chức vụ
                                    </label>
                                    <input
                                        type="text"
                                        name="Chức vụ"
                                        value={formData['Chức vụ']}
                                        onChange={handleInputChange}
                                        disabled={!editing || isSubmitting}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-gray-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Phòng
                                    </label>
                                    <input
                                        type="text"
                                        name="Phòng"
                                        value={formData['Phòng']}
                                        onChange={handleInputChange}
                                        disabled={!editing || isSubmitting}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-gray-50"
                                    />
                                </div>
                                
                                <div className="sm:col-span-2 mt-2">
                                    <div className="text-sm text-gray-500">
                                        Tên đăng nhập: <span className="font-medium text-gray-700">{userData?.username}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Change Password Modal */}
            {changePassword && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-800">Đổi mật khẩu</h3>
                            <button
                                onClick={() => !isChangingPassword && setChangePassword(false)}
                                disabled={isChangingPassword}
                                className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Mật khẩu hiện tại <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    name="currentPassword"
                                    value={passwordData.currentPassword}
                                    onChange={handlePasswordChange}
                                    disabled={isChangingPassword}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Mật khẩu mới <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    value={passwordData.newPassword}
                                    onChange={handlePasswordChange}
                                    disabled={isChangingPassword}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Xác nhận mật khẩu mới <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={passwordData.confirmPassword}
                                    onChange={handlePasswordChange}
                                    disabled={isChangingPassword}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                                    required
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t flex justify-end space-x-2">
                            <button
                                onClick={() => setChangePassword(false)}
                                disabled={isChangingPassword}
                                className={`px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors ${isChangingPassword ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handlePasswordSubmit}
                                disabled={isChangingPassword}
                                className={`px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center ${isChangingPassword ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                            >
                                {isChangingPassword ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                        Đang xử lý...
                                    </>
                                ) : (
                                    'Xác nhận'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Container */}
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
        </div>
    );
};

export default Profile;