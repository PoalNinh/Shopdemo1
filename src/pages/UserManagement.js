import React, { useState, useEffect } from 'react';
import {
    UserPlus,
    Pencil,
    Trash2,
    Loader2,
    X,
    Search,
    Check,
    AlertTriangle
} from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import authUtils from '../utils/authUtils';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imageFile, setImageFile] = useState(null);

    const [formData, setFormData] = useState({
        username: '',
        password: '',
        'Họ và Tên': '',
        'Chức vụ': '',
        'Phòng': '',
        'Email': '',
        'Image': '',
        'Phân quyền': 'User'
    });

    const currentUser = authUtils.getUserData();
    const isAdmin = currentUser?.['Phân quyền'] === 'Admin';

    // Function to get correct image URL
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

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await authUtils.apiRequest('DSNV', 'Find', {});
            setUsers(response || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Không thể tải danh sách nhân viên');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        
        if (name === 'admin') {
            setFormData(prev => ({
                ...prev,
                'Phân quyền': checked ? 'Admin' : 'User'
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

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

    const handleSubmit = async () => {
        if (isSubmitting) return;
        
        // Validation
        if (!formData.username) {
            toast.error('Username không được để trống');
            return;
        }
        
        if (!selectedUser && !formData.password) {
            toast.error('Mật khẩu không được để trống khi tạo mới');
            return;
        }

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
            
            // Prepare data for API
            const userData = {
                ...formData,
                'Image': imageUrl
            };
            
            // Remove empty password if editing
            if (selectedUser && !userData.password) {
                delete userData.password;
            }

            if (!selectedUser) {
                // Check if username already exists
                const existingUser = users.find(user => user.username === userData.username);
                if (existingUser) {
                    toast.error('Username đã tồn tại');
                    setIsSubmitting(false);
                    return;
                }
                
                // Create new user
                await authUtils.apiRequest('DSNV', 'Add', {
                    Rows: [userData]
                });
                toast.success('Thêm nhân viên thành công');
            } else {
                // Update existing user
                await authUtils.apiRequest('DSNV', 'Edit', {
                    Rows: [{
                        ...selectedUser,
                        ...userData
                    }]
                });
                toast.success('Cập nhật thông tin thành công');
            }

            setIsModalOpen(false);
            resetForm();
            fetchUsers();
        } catch (error) {
            console.error('Error saving user:', error);
            toast.error(selectedUser ? 'Cập nhật thất bại' : 'Thêm nhân viên thất bại');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedUser || isSubmitting) return;

        try {
            setIsSubmitting(true);
            await authUtils.apiRequest('DSNV', 'Delete', {
                Rows: [{ username: selectedUser.username }]
            });
            toast.success('Xóa nhân viên thành công');
            setIsDeleteModalOpen(false);
            fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Xóa nhân viên thất bại');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            username: '',
            password: '',
            'Họ và Tên': '',
            'Chức vụ': '',
            'Phòng': '',
            'Email': '',
            'Image': '',
            'Phân quyền': 'User'
        });
        setSelectedUser(null);
        setImageFile(null);
    };

    const filteredUsers = users.filter(user =>
        user['Họ và Tên']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user['Email']?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    const Modal = ({ isOpen, onClose, title, children }) => {
        if (!isOpen) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center p-4 border-b">
                        <h3 className="text-lg font-semibold">{title}</h3>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    {children}
                </div>
            </div>
        );
    };

    return (
        <div className="p-6">
            {!isAdmin && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
                        <div>
                            <h3 className="font-semibold text-yellow-800">Cảnh báo</h3>
                            <p className="text-yellow-700">
                                Bạn không có quyền truy cập trang này. Vui lòng liên hệ admin để được cấp quyền.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm">
                <div className="p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">Quản lý nhân viên</h2>

                        {isAdmin && (
                            <button
                                onClick={() => {
                                    resetForm();
                                    setIsModalOpen(true);
                                }}
                                className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            >
                                <UserPlus className="w-4 h-4 mr-2" />
                                Thêm nhân viên
                            </button>
                        )}
                    </div>

                    <div className="mb-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm nhân viên..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-6 sm:mx-0">
                        <div className="inline-block min-w-full align-middle">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nhân viên</th>
                                        <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                                        <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                        <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chức vụ</th>
                                        <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phòng</th>
                                        <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                                        {isAdmin && <th className="px-3 sm:px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map((user) => (
                                            <tr key={user.username} className="hover:bg-gray-50">
                                                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center space-x-2 sm:space-x-3">
                                                        {user['Image'] ? (
                                                            <img
                                                                src={getImageUrl(user['Image'])}
                                                                alt={user['Họ và Tên']}
                                                                className="w-8 h-8 rounded-full object-cover"
                                                                onError={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user['Họ và Tên'] || user.username)}&background=4F46E5&color=fff`;
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                                                                {user['Họ và Tên']?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || '?'}
                                                            </div>
                                                        )}
                                                        <span className="font-medium">{user['Họ và Tên'] || user.username}</span>
                                                    </div>
                                                </td>
                                                <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap">{user.username}</td>
                                                <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap">{user['Email']}</td>
                                                <td className="hidden lg:table-cell px-4 py-3 whitespace-nowrap">{user['Chức vụ']}</td>
                                                <td className="hidden lg:table-cell px-4 py-3 whitespace-nowrap">{user['Phòng']}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {user['Phân quyền'] === 'Admin' ? (
                                                        <div className="flex items-center">
                                                            <Check className="h-4 w-4 text-green-500" />
                                                            <span className="ml-1 text-xs text-green-600">Admin</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center">
                                                            <X className="h-4 w-4 text-gray-400" />
                                                            <span className="ml-1 text-xs text-gray-500">User</span>
                                                        </div>
                                                    )}
                                                </td>
                                                {isAdmin && (
                                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                                        <div className="flex items-center justify-end space-x-2">
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedUser(user);
                                                                    setFormData({
                                                                        ...user,
                                                                        password: '',
                                                                        admin: user['Phân quyền'] === 'Admin'
                                                                    });
                                                                    setIsModalOpen(true);
                                                                }}
                                                                className="p-1 text-blue-500 hover:text-blue-600"
                                                                title="Chỉnh sửa"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedUser(user);
                                                                    setIsDeleteModalOpen(true);
                                                                }}
                                                                className="p-1 text-red-500 hover:text-red-600"
                                                                title="Xóa"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={isAdmin ? 7 : 6} className="px-4 py-6 text-center text-gray-500">
                                                {searchTerm ? 'Không tìm thấy nhân viên phù hợp' : 'Chưa có nhân viên nào'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add/Edit User Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    if (isSubmitting) return;
                    setIsModalOpen(false);
                    resetForm();
                }}
                title={selectedUser ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}
            >
                <div className="p-4">
                    <div className="flex justify-center mb-6">
                        <div className="relative group">
                            {formData['Image'] ? (
                                <img
                                    src={formData['Image'] instanceof File ? URL.createObjectURL(formData['Image']) : getImageUrl(formData['Image'])}
                                    alt="Preview"
                                    className="w-24 h-24 rounded-full object-cover"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData['Họ và Tên'] || formData.username)}&background=4F46E5&color=fff`;
                                    }}
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-white text-2xl font-semibold">
                                    {formData['Họ và Tên']?.[0]?.toUpperCase() || formData.username?.[0]?.toUpperCase() || '?'}
                                </div>
                            )}
                            <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleImageChange}
                                    disabled={isSubmitting}
                                />
                                <span className="text-white text-sm">Thay đổi ảnh</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Username <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={selectedUser || isSubmitting}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {selectedUser ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu *'}
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isSubmitting}
                                    required={!selectedUser}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Họ và tên
                                </label>
                                <input
                                    type="text"
                                    name="Họ và Tên"
                                    value={formData['Họ và Tên']}
                                    onChange={handleInputChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isSubmitting}
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isSubmitting}
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isSubmitting}
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="admin"
                                    checked={formData['Phân quyền'] === 'Admin'}
                                    onChange={handleInputChange}
                                    className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                                    disabled={isSubmitting}
                                />
                                <span className="text-sm font-medium text-gray-700">
                                    Cấp quyền Admin
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            onClick={() => {
                                setIsModalOpen(false);
                                resetForm();
                            }}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                            disabled={isSubmitting}
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <div className="flex items-center">
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Đang xử lý...
                                </div>
                            ) : selectedUser ? (
                                'Cập nhật'
                            ) : (
                                'Thêm mới'
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    if (isSubmitting) return;
                    setIsDeleteModalOpen(false);
                }}
                title="Xác nhận xóa nhân viên"
            >
                <div className="p-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center">
                            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                            <h3 className="font-semibold text-red-800">Cảnh báo</h3>
                        </div>
                        <p className="mt-2 text-red-700">
                            Bạn có chắc chắn muốn xóa nhân viên "{selectedUser?.['Họ và Tên'] || selectedUser?.username}" không?
                            Hành động này không thể hoàn tác.
                        </p>
                    </div>

                    <div className="mt-6 flex justify-end space-x-2">
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                            disabled={isSubmitting}
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <div className="flex items-center">
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Đang xử lý...
                                </div>
                            ) : (
                                'Xóa'
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

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

export default UserManagement;