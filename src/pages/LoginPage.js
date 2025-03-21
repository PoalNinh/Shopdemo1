import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import authUtils from '../utils/authUtils';
import config from '../config/config';
import { toast } from 'react-toastify';
import { Card, CardContent } from '../components/ui/card';
import { Eye, EyeOff, Lock, User } from 'lucide-react';

const LoginPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: ''
    });

    useEffect(() => {
        if (authUtils.isAuthenticated()) {
            const returnUrl = localStorage.getItem('returnUrl');
            if (returnUrl) {
                localStorage.removeItem('returnUrl');
                navigate(returnUrl);
            } else {
                navigate(config.ROUTES.DASHBOARD);
            }
        }
    }, [navigate]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.username || !formData.password) {
            toast.error('Vui lòng nhập đầy đủ thông tin đăng nhập!');
            return;
        }

        setLoading(true);
        try {
            const user = await authUtils.login(formData.username, formData.password);
            toast.success(`Chào mừng ${user.username} đã quay trở lại!`);

            setTimeout(() => {
                const returnUrl = localStorage.getItem('returnUrl');
                if (returnUrl) {
                    localStorage.removeItem('returnUrl');
                    navigate(returnUrl);
                } else {
                    navigate(config.ROUTES.DASHBOARD);
                }
            }, 1500);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-full max-w-md mx-4">


                <Card className="shadow-lg border border-gray-100">
                    <CardContent className="p-8">
                        <div className="text-center mb-8">
                            {/* Logo - Thay thế đường dẫn bằng logo của bạn */}
                            <img
                                src="https://toolapp.name.vn/logo1.png"
                                alt="Logo"
                                className="h-20 mx-auto mb-4"
                            />
                            {/* Nếu logo là SVG có thể thêm trực tiếp ở đây */}
                            {/* <svg className="h-12 w-auto mx-auto mb-4">...</svg> */}
                        </div>
                        <div className="text-center mb-8">
                            <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                                Đăng nhập
                            </h1>
                            <p className="text-gray-600">
                                Vui lòng đăng nhập để tiếp tục
                            </p>
                        </div>

                        {location.state?.from && (
                            <div className="mb-6 p-4 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg">
                                Bạn cần đăng nhập để truy cập trang {location.state.from}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label
                                    htmlFor="username"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Tên đăng nhập
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        id="username"
                                        name="username"
                                        type="text"
                                        required
                                        placeholder="Nhập tên đăng nhập"
                                        className="w-full h-11 pl-10 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors outline-none"
                                        value={formData.username}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Mật khẩu
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        placeholder="Nhập mật khẩu"
                                        className="w-full h-11 pl-10 pr-12 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors outline-none"
                                        value={formData.password}
                                        onChange={handleChange}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5" />
                                        ) : (
                                            <Eye className="h-5 w-5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center disabled:opacity-70"
                            >
                                {loading ? (
                                    <div className="flex items-center">
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Đang xử lý...
                                    </div>
                                ) : (
                                    'Đăng nhập'
                                )}
                            </button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default LoginPage;