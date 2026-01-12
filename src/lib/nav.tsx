'use client';

import Link from 'next/link';
import { AlbumList, AlbumTitle } from '../types/albums';
import React from 'react';
import { motion, useInView } from 'framer-motion';
import { GlobeIcon, InfoIcon, SocialIcon } from './icons';
import { titleToSlug } from './api/slug';

// Animated menu item component
const NavMenuItem: React.FC<{
  children: React.ReactNode;
  index: number;
  className?: string;
}> = ({ children, index, className = '' }) => {
  const itemRef = React.useRef<HTMLLIElement>(null);
  // Use once: true so items animate in and stay visible
  const isInView = useInView(itemRef, { once: true, amount: 0.1 });

  return (
    <motion.li
      ref={itemRef}
      className={`max-w-fit ${className}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{
        opacity: isInView ? 1 : 0,
        x: isInView ? 0 : -20,
      }}
      transition={{ 
        duration: 0.3, 
        ease: "easeOut",
        delay: index * 0.04 // Stagger effect
      }}
      whileHover={{ 
        x: 4,
        scale: 1.02,
        transition: { duration: 0.15 }
      }}
    >
      {children}
    </motion.li>
  );
};

export const Nav: React.FC<{
  title?: AlbumTitle;
  albums: AlbumList;
  isCollapsed?: boolean;
  isScrollCollapsed?: boolean;
}> = ({ albums, title = '', isCollapsed = false, isScrollCollapsed = false, ...props }) => {
  const isInAlbum = !!title;
  const sortedAlbums = React.useMemo(
    () => [...albums].sort((a, b) => a.title.localeCompare(b.title)),
    [albums]
  );

  return (
    <nav className="text-lg max-sm:!text-2xl" {...props}>
      {!isInAlbum && (
        <h1 className="mb-10 max-sm:flex max-sm:justify-center">
          <Link
            href="/"
            className={`hover:text-red-600 font-bold flex items-center gap-2 leading-none tracking-tight duration-200 ease-in-out transition-colors`}
          >
            <GlobeIcon />
            <span className="sm:hidden">Home</span>
          </Link>
        </h1>
      )}

      <motion.ul 
        className={`flex flex-col max-sm:items-center max-sm:mb-8 content-start tracking-tight ${
          isInAlbum ? 'hidden sm:flex sm:flex-col' : ''
        } ${isScrollCollapsed ? 'nav-list-collapsed' : 'nav-list-expanded'}`}
        style={{
          overflow: 'hidden',
        }}
        animate={{
          maxHeight: isScrollCollapsed ? 0 : '80vh',
          opacity: isScrollCollapsed ? 0 : 1,
        }}
        transition={{
          maxHeight: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
          opacity: { duration: 0.4, ease: 'easeInOut' }
        }}
      >
        {sortedAlbums.map((album, index) => {
          const isActive = title.toLowerCase() === album.title.toLowerCase();
          return (
            <NavMenuItem key={album.title} index={index}>
              <Link
                href={`/${titleToSlug(album.title)}`}
                className={`block py-0.5 transition-colors duration-200 ${
                  isActive ? 'font-bold' : 'hover:text-gray-400'
                }`}
                prefetch={false}
              >
                {album.title}
              </Link>
            </NavMenuItem>
          );
        })}
        {title && (
          <>
            <NavMenuItem index={sortedAlbums.length} className="sm:mt-10 flex gap-1 max-sm:hidden">
              <Link
                href="/about"
                prefetch={false}
                className="flex gap-1 items-center text-2xl sm:leading-5 sm:text-[15px] text-gray-400 hover:text-gray-500"
              >
                <InfoIcon />
                About
              </Link>
            </NavMenuItem>
            <NavMenuItem index={sortedAlbums.length + 1} className="flex sm:mt-1 gap-1 max-sm:hidden">
              <Link
                href="/about"
                prefetch={false}
                className="flex gap-1 items-center text-2xl sm:leading-5 sm:text-[15px] text-gray-400 hover:text-gray-500"
              >
                <SocialIcon />
                Socials
              </Link>
            </NavMenuItem>
          </>
        )}
      </motion.ul>
    </nav>
  );
};

export default Nav;
