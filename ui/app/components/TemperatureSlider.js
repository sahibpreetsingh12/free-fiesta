"use client";

export default function TemperatureSlider({ value, onChange }) {
  return (
    <div className="slider-container">
      <label>
        <strong>Temperature:</strong> {value}
      </label>
      <input
        type="range"
        min="0"
        max="2"
        step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}

