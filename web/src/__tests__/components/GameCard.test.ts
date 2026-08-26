import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import GameCard from '@/components/GameCard.vue';
import type { Game, PriceRecord } from '@/types';

describe('GameCard', () => {
  const mockGame: Game = {
    id: '70010000000186',
    title: 'The Legend of Zelda',
    platform: 'switch1',
    coverUrl: 'https://example.com/cover.jpg',
    releaseDate: '2017-03-03',
  };

  const mockPrice: PriceRecord = {
    id: '70010000000186',
    amount: 1490,
    currency: 'TWD',
    regularPrice: 1490,
    salesStatus: 'onsale',
  };

  const mockDiscountPrice: PriceRecord = {
    id: '70010000000187',
    amount: 990,
    currency: 'TWD',
    regularPrice: 1490,
    salesStatus: 'onsale',
    discountPrice: 990,
    discountStart: '2026-08-01',
    discountEnd: '2026-08-31',
  };

  it('should render game title', () => {
    const wrapper = mount(GameCard, {
      props: { game: mockGame, price: mockPrice, isIgnored: false },
    });
    expect(wrapper.text()).toContain('The Legend of Zelda');
  });

  it('should show game cover image', () => {
    const wrapper = mount(GameCard, {
      props: { game: mockGame, price: mockPrice, isIgnored: false },
    });
    const img = wrapper.find('img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBe('https://example.com/cover.jpg');
  });

  it('should show price in TWD', () => {
    const wrapper = mount(GameCard, {
      props: { game: mockGame, price: mockPrice, isIgnored: false },
    });
    expect(wrapper.text()).toContain('NT$');
    expect(wrapper.text()).toContain('1,490');
  });

  it('should show discount badge when discounted', () => {
    const wrapper = mount(GameCard, {
      props: { game: { ...mockGame, id: mockDiscountPrice.id }, price: mockDiscountPrice, isIgnored: false },
    });
    expect(wrapper.find('[data-testid="discount-badge"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('990');
  });

  it('should not show discount badge when no discount', () => {
    const wrapper = mount(GameCard, {
      props: { game: mockGame, price: mockPrice, isIgnored: false },
    });
    expect(wrapper.find('[data-testid="discount-badge"]').exists()).toBe(false);
  });

  it('should show regular price with strikethrough when discounted', () => {
    const wrapper = mount(GameCard, {
      props: { game: { ...mockGame, id: mockDiscountPrice.id }, price: mockDiscountPrice, isIgnored: false },
    });
    expect(wrapper.find('[data-testid="original-price"]').exists()).toBe(true);
  });

  it('should show "無資料" when price is null', () => {
    const wrapper = mount(GameCard, {
      props: { game: mockGame, price: null, isIgnored: false },
    });
    expect(wrapper.text()).toContain('無資料');
  });

  it('should show platform badge', () => {
    const wrapper = mount(GameCard, {
      props: { game: mockGame, price: mockPrice, isIgnored: false },
    });
    expect(wrapper.text()).toContain('Switch');
  });

  it('should emit "toggle-ignore" event when button is clicked', async () => {
    const wrapper = mount(GameCard, {
      props: { game: mockGame, price: mockPrice, isIgnored: false },
    });
    const button = wrapper.find('[data-testid="toggle-ignore-btn"]');
    expect(button.exists()).toBe(true);
    await button.trigger('click');
    expect(wrapper.emitted('toggle-ignore')).toHaveLength(1);
    expect(wrapper.emitted('toggle-ignore')![0]).toEqual(['70010000000186']);
  });

  it('should emit "toggle-ignore" with correct id when ignored', async () => {
    const wrapper = mount(GameCard, {
      props: { game: mockGame, price: mockPrice, isIgnored: true },
    });
    const button = wrapper.find('[data-testid="toggle-ignore-btn"]');
    await button.trigger('click');
    expect(wrapper.emitted('toggle-ignore')![0]).toEqual(['70010000000186']);
  });

  it('should apply ignored style when isIgnored is true', () => {
    const wrapper = mount(GameCard, {
      props: { game: mockGame, price: mockPrice, isIgnored: true },
    });
    expect(wrapper.classes()).toContain('game-card--ignored');
  });

  it('should emit "toggle-wishlist" event when wishlist button is clicked', async () => {
    const wrapper = mount(GameCard, {
      props: { game: mockGame, price: mockPrice, isIgnored: false, isWishlisted: false },
    });
    const button = wrapper.find('[data-testid="toggle-wishlist-btn"]');
    expect(button.exists()).toBe(true);
    await button.trigger('click');
    expect(wrapper.emitted('toggle-wishlist')).toHaveLength(1);
    expect(wrapper.emitted('toggle-wishlist')![0]).toEqual(['70010000000186']);
  });
});
