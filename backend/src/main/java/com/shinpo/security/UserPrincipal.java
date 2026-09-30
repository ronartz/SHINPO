package com.shinpo.security;

import com.shinpo.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.Objects;

public class UserPrincipal implements UserDetails {

    private final Long userId;
    private final String username;
    private final String email;
    private final String password;
    private final boolean active;
    private final Collection<? extends GrantedAuthority> authorities;

    public UserPrincipal(Long userId, String username, String email, String password, boolean active, Collection<? extends GrantedAuthority> authorities) {
        this.userId = userId;
        this.username = username;
        this.email = email;
        this.password = password;
        this.active = active;
        this.authorities = authorities;
    }

    public UserPrincipal(Long userId, String username, String email, String password, Collection<? extends GrantedAuthority> authorities) {
        this(userId, username, email, password, true, authorities);
    }

    public static UserPrincipal create(User user) {
        String role = (user.getRole() != null && !user.getRole().isBlank()) ? user.getRole() : "ROLE_USER";
        List<GrantedAuthority> authorities = List.of(new SimpleGrantedAuthority(role));
        return new UserPrincipal(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getPasswordHash(),
                user.isActive(),
                authorities
        );
    }

    public Long getUserId() {
        return userId;
    }

    public String getEmail() {
        return email;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    public String getRole() {
        return authorities.stream()
                .findFirst()
                .map(GrantedAuthority::getAuthority)
                .orElse("ROLE_USER");
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        UserPrincipal that = (UserPrincipal) o;
        return Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId);
    }
}
