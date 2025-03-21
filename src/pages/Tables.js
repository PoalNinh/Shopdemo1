import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash, Search, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import authUtils from '../utils/authUtils';

const TableManagement = () => {
    // State Management
    const [tables, setTables] = useState([]);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(8); // Reduced for better card display
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedTables, setSelectedTables] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        status: '',
        capacity: { min: '', max: '' }
    });
    const [currentTable, setCurrentTable] = useState({
        IDBAN: '',
        'Tên bàn': '',
        'Sức chứa tối đa': '',
        'Trạng thái': 'Trống'
    });

    // Validation Function
    const validateTable = (table) => {
        const errors = [];
        if (!table['Tên bàn']) errors.push('Tên bàn không được để trống');
        if (!table['Sức chứa tối đa']) errors.push('Sức chứa tối đa không được để trống');
        if (Number(table['Sức chứa tối đa']) <= 0) errors.push('Sức chứa tối đa phải lớn hơn 0');
        return errors;
    };

    // Fetch Tables
    useEffect(() => {
        fetchTables();
    }, []);

    const fetchTables = async () => {
        try {
            const response = await authUtils.apiRequest('DSBAN', 'Find', {});
            setTables(response);
        } catch (error) {
            console.error('Error fetching tables:', error);
            toast.error('Lỗi khi tải danh sách bàn');
        }
    };

    // Handle Table Modal
    const handleOpen = (table = null) => {
        if (table) {
            setCurrentTable({
                IDBAN: table.IDBAN || '',
                'Tên bàn': table['Tên bàn'] || '',
                'Sức chứa tối đa': table['Sức chứa tối đa'] || '',
                'Trạng thái': table['Trạng thái'] || 'Trống'
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setCurrentTable({
            IDBAN: '',
            'Tên bàn': '',
            'Sức chứa tối đa': '',
            'Trạng thái': 'Trống'
        });
    };

    // Handle Form Input
    const handleInputChange = (field, value) => {
        setCurrentTable(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Save Table
    const handleSave = async () => {
        if (isSubmitting) return;

        try {
            setIsSubmitting(true);
            const errors = validateTable(currentTable);
            if (errors.length > 0) {
                toast.error(errors.join('\n'));
                return;
            }

            const tableData = {
                ...currentTable,
                'Sức chứa tối đa': Number(currentTable['Sức chứa tối đa'])
            };

            if (tableData.IDBAN) {
                await authUtils.apiRequest('DSBAN', 'Edit', {
                    "Rows": [tableData]
                });
                toast.success('Cập nhật bàn thành công!');
            } else {
                const existingTables = await authUtils.apiRequest('DSBAN', 'Find', {});
                const maxID = existingTables.reduce((max, table) => {
                    const id = parseInt(table.IDBAN.replace('B', '')) || 0;
                    return id > max ? id : max;
                }, 0);

                const newID = maxID + 1;
                const newIDBAN = `B${newID.toString().padStart(3, '0')}`;
                tableData.IDBAN = newIDBAN;

                await authUtils.apiRequest('DSBAN', 'Add', {
                    "Rows": [tableData]
                });
                toast.success('Thêm bàn thành công!');
            }

            await fetchTables();
            handleClose();
        } catch (error) {
            console.error('Error saving table:', error);
            toast.error('Có lỗi xảy ra: ' + (error.message || 'Không thể lưu thông tin bàn'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete Table
    const handleDelete = async (IDBAN) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa bàn này?')) {
            try {
                await authUtils.apiRequest('DSBAN', 'Delete', {
                    "Rows": [{ "IDBAN": IDBAN }]
                });
                toast.success('Xóa bàn thành công!');
                await fetchTables();
            } catch (error) {
                console.error('Error deleting table:', error);
                toast.error('Có lỗi xảy ra khi xóa bàn');
            }
        }
    };

    // Bulk Delete
    const handleBulkDelete = async () => {
        if (selectedTables.length === 0) {
            toast.warning('Vui lòng chọn bàn để xóa');
            return;
        }

        if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedTables.length} bàn đã chọn?`)) {
            try {
                const deletePromises = selectedTables.map(id =>
                    authUtils.apiRequest('DSBAN', 'Delete', {
                        "Rows": [{ "IDBAN": id }]
                    })
                );

                await Promise.all(deletePromises);
                toast.success('Xóa bàn thành công!');
                setSelectedTables([]);
                await fetchTables();
            } catch (error) {
                toast.error('Có lỗi xảy ra khi xóa bàn');
            }
        }
    };

    // Filtering and Pagination
    const filteredTables = tables.filter(table => {
        const matchesSearch =
            table['Tên bàn']?.toLowerCase().includes(search.toLowerCase()) ||
            table.IDBAN?.toLowerCase().includes(search.toLowerCase());

        const matchesStatus = !filters.status || table['Trạng thái'] === filters.status;
        const matchesCapacity = (
            (!filters.capacity.min || Number(table['Sức chứa tối đa']) >= Number(filters.capacity.min)) &&
            (!filters.capacity.max || Number(table['Sức chứa tối đa']) <= Number(filters.capacity.max))
        );

        return matchesSearch && matchesStatus && matchesCapacity;
    });

    const totalPages = Math.ceil(filteredTables.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredTables.slice(indexOfFirstItem, indexOfLastItem);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    // Get status style
    const getStatusStyle = (status) => {
        switch (status) {
            case 'Trống':
                return 'bg-green-100 text-green-800';
            case 'Đang phục vụ':
                return 'bg-blue-100 text-blue-800';
            case 'Đã đặt trước':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    // Toggle table selection
    const toggleTableSelection = (IDBAN) => {
        if (selectedTables.includes(IDBAN)) {
            setSelectedTables(selectedTables.filter(id => id !== IDBAN));
        } else {
            setSelectedTables([...selectedTables, IDBAN]);
        }
    };

    // Select all tables
    const toggleSelectAll = () => {
        if (selectedTables.length === filteredTables.length) {
            setSelectedTables([]);
        } else {
            setSelectedTables(filteredTables.map(t => t.IDBAN));
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Quản lý Bàn</CardTitle>
            </CardHeader>
            <CardContent>
                {/* Header Section - Responsive */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-2 sm:space-y-0">
                    <div className="relative w-full sm:w-64 mb-4 sm:mb-0">
                        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm bàn..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="w-full sm:w-auto px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                        >
                            <Filter className="w-4 h-4" />
                            Bộ lọc
                        </button>
                        {selectedTables.length > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="w-full sm:w-auto px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center gap-2"
                            >
                                <Trash className="w-4 h-4" />
                                Xóa ({selectedTables.length})
                            </button>
                        )}
                        <button
                            onClick={() => handleOpen()}
                            className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Thêm Bàn
                        </button>
                    </div>
                </div>

                {/* Filter Section */}
                {showFilters && (
                    <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="p-2 border rounded-lg w-full"
                            >
                                <option value="">Tất cả trạng thái</option>
                                <option value="Trống">Trống</option>
                                <option value="Đang phục vụ">Đang phục vụ</option>
                                <option value="Đã đặt trước">Đã đặt trước</option>
                            </select>
                            <div className="flex flex-col sm:flex-row gap-2 items-center">
                                <input
                                    type="number"
                                    placeholder="Sức chứa từ"
                                    value={filters.capacity.min}
                                    onChange={(e) => setFilters({
                                        ...filters,
                                        capacity: { ...filters.capacity, min: e.target.value }
                                    })}
                                    className="p-2 border rounded-lg w-full"
                                />
                                <span>-</span>
                                <input
                                    type="number"
                                    placeholder="Sức chứa đến"
                                    value={filters.capacity.max}
                                    onChange={(e) => setFilters({
                                        ...filters,
                                        capacity: { ...filters.capacity, max: e.target.value }
                                    })}
                                    className="p-2 border rounded-lg w-full"
                                />
                            </div>
                            <button
                                onClick={() => setFilters({
                                    status: '',
                                    capacity: { min: '', max: '' }
                                })}
                                className="w-full px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100"
                            >
                                Xóa bộ lọc
                            </button>
                        </div>
                    </div>
                )}

                {/* Bulk select option */}
                {filteredTables.length > 0 && (
                    <div className="flex items-center mb-4">
                        <input
                            type="checkbox"
                            checked={selectedTables.length === filteredTables.length}
                            onChange={toggleSelectAll}
                            className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">
                            {selectedTables.length === filteredTables.length 
                                ? 'Bỏ chọn tất cả' 
                                : 'Chọn tất cả'}
                        </span>
                    </div>
                )}

                {/* Card Grid Section */}
                {currentItems.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
                        {currentItems.map((table) => (
                            <div 
                                key={table.IDBAN} 
                                className={`border rounded-lg shadow-sm hover:shadow transition-all ${
                                    selectedTables.includes(table.IDBAN) ? 'ring-2 ring-blue-500' : ''
                                }`}
                            >
                                <div className="p-4 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-start">
                                            <input
                                                type="checkbox"
                                                checked={selectedTables.includes(table.IDBAN)}
                                                onChange={() => toggleTableSelection(table.IDBAN)}
                                                className="mt-1 mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <div>
                                                <h3 className="font-medium text-gray-900">{table['Tên bàn']}</h3>
                                                <p className="text-sm text-gray-500">{table.IDBAN}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusStyle(table['Trạng thái'])}`}>
                                            {table['Trạng thái']}
                                        </span>
                                    </div>
                                    
                                    <div className="text-sm text-gray-600 mb-4">
                                        <p>Sức chứa: <span className="font-medium">{table['Sức chứa tối đa']} người</span></p>
                                    </div>
                                    
                                    <div className="mt-auto flex justify-end space-x-2">
                                        <button
                                            onClick={() => handleOpen(table)}
                                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-full"
                                            title="Sửa"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(table.IDBAN)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                                            title="Xóa"
                                        >
                                            <Trash className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-gray-500">Không tìm thấy bàn nào</p>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center space-x-2 mt-6">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`p-2 rounded-lg ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-blue-500 hover:bg-blue-50'}`}
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>

                        <div className="flex items-center space-x-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }
                                
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`px-3 py-1 rounded-lg ${currentPage === pageNum ? 'bg-blue-500 text-white'
                                            : 'text-gray-600 hover:bg-blue-50'}`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className={`p-2 rounded-lg ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-blue-500 hover:bg-blue-50'}`}
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>

                        <span className="text-gray-600 ml-2 hidden sm:inline">
                            Trang {currentPage} / {totalPages}
                        </span>
                    </div>
                )}

                {/* Modal Add/Edit Table */}
                {open && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">
                                    {currentTable.IDBAN ? 'Cập nhật bàn' : 'Thêm bàn mới'}
                                </h2>
                                <button
                                    onClick={handleClose}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        placeholder="Tên bàn"
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={currentTable['Tên bàn']}
                                        onChange={(e) => handleInputChange('Tên bàn', e.target.value)}
                                        required
                                    />
                                    <input
                                        type="number"
                                        placeholder="Sức chứa tối đa"
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={currentTable['Sức chứa tối đa']}
                                        onChange={(e) => handleInputChange('Sức chứa tối đa', e.target.value)}
                                        min="1"
                                        required
                                    />

                                    <select
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={currentTable['Trạng thái']}
                                        onChange={(e) => handleInputChange('Trạng thái', e.target.value)}
                                    >
                                        <option value="Trống">Trống</option>
                                        <option value="Đang phục vụ">Đang phục vụ</option>
                                        <option value="Đã đặt trước">Đã đặt trước</option>
                                    </select>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={handleClose}
                                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                        disabled={isSubmitting}
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isSubmitting}
                                        className={`px-4 py-2 bg-blue-500 text-white rounded-lg ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'} flex items-center gap-2`}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Đang lưu...
                                            </>
                                        ) : 'Lưu'}
                                    </button>
                                </div>
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
            </CardContent>
        </Card>
    );
};

export default TableManagement;