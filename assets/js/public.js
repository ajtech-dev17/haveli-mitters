/* =================================================
   SQUAD PAGE & PLAYER CARD COMPLETE OVERLAP FIX
   ================================================= */
*, *::before, *::after {
  box-sizing: border-box;
}

.player {
  display: flex;
  flex-direction: column;
  padding: 0 !important;
  overflow: hidden !important;
}

.player-photo {
  height: 260px !important;
  width: 100% !important;
  overflow: hidden !important;
  position: relative !important;
  flex-shrink: 0;
}

.player-photo img {
  width: 100% !important;
  height: 100% !important;
  object-fit: cover !important;
  object-position: top center !important;
  display: block !important;
}

.player-photo::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(23, 19, 16, 0.5) 0%,
    transparent 45%,
    rgba(23, 19, 16, 0.85) 100%
  );
  pointer-events: none;
}

.player-photo .jersey {
  position: absolute !important;
  top: 12px !important;
  inset-inline-end: 12px !important;
  z-index: 2 !important;
  opacity: 1 !important;
  background: rgba(23, 19, 16, 0.78);
  color: var(--gold) !important;
  border: 1px solid var(--line);
  padding: 4px 12px;
  border-radius: 99px;
  font-size: 15px !important;
  line-height: 1.2;
}

.player-body {
  position: relative !important;
  z-index: 2 !important;
  background: var(--panel);
  padding: 20px !important;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.player-body .text-btn {
  margin-top: auto;
  align-self: flex-start;
}
