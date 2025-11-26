import React from 'react';
import { LogFilter } from '../../shared/types';
import './FilterControls.css';

interface FilterControlsProps {
    filter: LogFilter;
    onFilterChange: (filter: LogFilter) => void;
    onClearFilters: () => void;
}

const FilterControls: React.FC<FilterControlsProps> = ({ filter, onFilterChange, onClearFilters }) => {
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onFilterChange({ ...filter, search: e.target.value || undefined });
    };

    const handleMethodToggle = (method: string) => {
        const methods = filter.methods || [];
        const newMethods = methods.includes(method)
            ? methods.filter(m => m !== method)
            : [...methods, method];
        onFilterChange({ ...filter, methods: newMethods.length > 0 ? newMethods : undefined });
    };

    const handleStatusToggle = (status: number) => {
        const statusCodes = filter.statusCodes || [];
        const newStatusCodes = statusCodes.includes(status)
            ? statusCodes.filter(s => s !== status)
            : [...statusCodes, status];
        onFilterChange({ ...filter, statusCodes: newStatusCodes.length > 0 ? newStatusCodes : undefined });
    };

    const hasActiveFilters = filter.search || filter.methods?.length || filter.statusCodes?.length;

    return (
        <div className="filter-controls">
            <div className="filter-row">
                <input
                    type="text"
                    className="search-input"
                    placeholder="Search URL, method, or status..."
                    value={filter.search || ''}
                    onChange={handleSearchChange}
                />
                {hasActiveFilters && (
                    <button className="clear-filters-btn" onClick={onClearFilters}>
                        Clear Filters
                    </button>
                )}
            </div>

            <div className="filter-row">
                <div className="filter-group">
                    <label>Methods:</label>
                    <div className="filter-buttons">
                        {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(method => (
                            <button
                                key={method}
                                className={`filter-btn ${filter.methods?.includes(method) ? 'active' : ''}`}
                                onClick={() => handleMethodToggle(method)}
                            >
                                {method}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="filter-group">
                    <label>Status:</label>
                    <div className="filter-buttons">
                        {[200, 201, 204, 301, 302, 400, 401, 403, 404, 500, 502, 503].map(status => (
                            <button
                                key={status}
                                className={`filter-btn status-${Math.floor(status / 100)} ${filter.statusCodes?.includes(status) ? 'active' : ''
                                    }`}
                                onClick={() => handleStatusToggle(status)}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FilterControls;
