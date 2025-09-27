import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const StatCard = ({ 
  title, 
  value, 
  icon, 
  trend, 
  trendColor = 'text-green-600',
  onClick,
  delay = 0,
  gradient = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [animatedValue, setAnimatedValue] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Animation trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  // Value counter animation
  useEffect(() => {
    if (!isVisible) return;
    
    const duration = 1500; // 1.5 seconds
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setAnimatedValue(value);
        clearInterval(timer);
      } else {
        setAnimatedValue(Math.floor(current));
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [isVisible, value]);

  // Determine if trend is positive or negative
  const isPositiveTrend = trend && (trend.includes('+') || trend.includes('up') || trend.includes('increase'));
  const isNegativeTrend = trend && (trend.includes('-') || trend.includes('down') || trend.includes('decrease'));

  return (
    <div 
      className={`
        relative overflow-hidden rounded-xl p-6 shadow-sm border border-gray-100 cursor-pointer
        transform transition-all duration-500 ease-out
        ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
        ${isHovered ? 'scale-105 shadow-lg' : 'hover:scale-102 hover:shadow-md'}
        ${gradient 
          ? 'bg-gradient-to-br from-white via-gray-50 to-blue-50' 
          : 'bg-white hover:bg-gray-50'
        }
        group
      `}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
        <div className="w-full h-full transform rotate-12 scale-150">
          {icon}
        </div>
      </div>

      {/* Shimmer effect on hover */}
      <div className={`
        absolute inset-0 -top-2 -left-full h-full w-1/2 z-10
        bg-gradient-to-r from-transparent via-white/20 to-transparent
        transform skew-x-12 transition-all duration-700
        ${isHovered ? 'left-full' : ''}
      `} />

      <div className="relative z-20">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {/* Title */}
            <p className={`
              text-sm font-medium text-gray-600 mb-2
              transition-all duration-300
              ${isHovered ? 'text-gray-800' : ''}
            `}>
              {title}
            </p>
            
            {/* Animated Value */}
            <div className="relative">
              <p className={`
                text-3xl font-bold text-gray-900 transition-all duration-300
                ${isHovered ? 'text-blue-600' : ''}
              `}>
                {animatedValue}
              </p>
              
              {/* Value change indicator */}
              {isVisible && (
                <div className={`
                  absolute -top-2 -right-4 w-2 h-2 rounded-full
                  animate-ping bg-blue-400 opacity-75
                  ${animatedValue === value ? 'opacity-0' : ''}
                  transition-opacity duration-500
                `} />
              )}
            </div>

            {/* Trend */}
            {trend && (
              <div className={`
                flex items-center gap-1 mt-2 text-xs font-medium
                transform transition-all duration-300 
                ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}
                ${trendColor}
              `}>
                {isPositiveTrend && (
                  <TrendingUp className="w-3 h-3 animate-bounce" />
                )}
                {isNegativeTrend && (
                  <TrendingDown className="w-3 h-3 animate-bounce" />
                )}
                <span className="transition-all duration-200 group-hover:font-semibold">
                  {trend}
                </span>
              </div>
            )}
          </div>

          {/* Icon Container */}
          <div className={`
            p-3 rounded-lg transition-all duration-300 transform
            ${isHovered 
              ? 'bg-blue-500 scale-110 rotate-3' 
              : 'bg-blue-100 group-hover:bg-blue-200'
            }
          `}>
            <div className={`
              w-6 h-6 transition-all duration-300
              ${isHovered ? 'text-white scale-110' : 'text-blue-600'}
            `}>
              {icon}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom accent line */}
      <div className={`
        absolute bottom-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500
        transition-all duration-500 ease-out
        ${isVisible ? 'w-full' : 'w-0'}
      `} />

      {/* Pulse effect for important metrics */}
      {(title.includes('Overdue') || title.includes('Critical')) && (
        <div className="absolute inset-0 rounded-xl animate-pulse bg-red-100 opacity-20" />
      )}
    </div>
  );
};

export default StatCard;