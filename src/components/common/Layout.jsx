// src/components/Layout.jsx
import React from "react";

export default function Layout({ children }) {
  return (
    <div className="flex-1 p-6 overflow-y-auto">
      {children}
    </div>
  );
}